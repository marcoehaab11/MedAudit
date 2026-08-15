using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Notifications;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Notifications;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class NotificationWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task EnqueueNotificationCreatesDeliveryAndOutboxMessage()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "notif-clinic-1", "admin@notif1.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var req = new NotificationRequest(
            NotificationChannel.Email,
            RecipientType.Patient,
            Guid.NewGuid(),
            "patient@example.com",
            "AppointmentReminder",
            "en",
            new Dictionary<string, string> { ["PatientName"] = "Salma" },
            "Appointment",
            Guid.NewGuid(),
            "key-1001"
        );

        var deliveryId = await service.EnqueueNotificationAsync(req, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, deliveryId);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var delivery = await db.NotificationDeliveries.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.Id == deliveryId);
        Assert.NotNull(delivery);
        Assert.Equal(NotificationStatus.Pending, delivery.Status);
        Assert.Equal("patient@example.com", delivery.Destination);

        var outbox = await db.OutboxMessages.FirstOrDefaultAsync(o => o.TenantId == clinic.TenantId);
        Assert.NotNull(outbox);
        Assert.Equal(OutboxStatus.Pending, outbox.Status);
    }

    [Fact]
    public async Task InAppNotificationDispatchesToUserInboxAndEnforcesUserIsolation()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inapp-clinic", "admin@inapp.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        var targetUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var req = new NotificationRequest(
            NotificationChannel.InApp,
            RecipientType.Staff,
            targetUserId,
            targetUserId.ToString("D"),
            "SystemNotice",
            "en",
            new Dictionary<string, string> { ["ClinicName"] = "InApp Clinic" },
            "Notice",
            Guid.NewGuid(),
            "inapp-key-1"
        );

        await service.EnqueueNotificationAsync(req, CancellationToken.None);

        // Process Outbox via Worker OutboxProcessor
        var store = scope.ServiceProvider.GetRequiredService<INotificationStore>();
        var messages = await store.LockPendingOutboxMessagesAsync(10, CancellationToken.None);
        Assert.NotEmpty(messages);

        // Invoke provider dispatch
        var provider = scope.ServiceProvider.GetServices<DentalClinic.Infrastructure.Notifications.INotificationProvider>()
            .First(p => p.Channel == NotificationChannel.InApp);

        var msg = messages.First();
        using var json = System.Text.Json.JsonDocument.Parse(msg.Payload);
        var deliveryId = json.RootElement.GetProperty("DeliveryId").GetGuid();
        var delivery = await store.FindDeliveryByIdAsync(clinic.TenantId, deliveryId, CancellationToken.None);

        var dispatchCtx = new DentalClinic.Infrastructure.Notifications.NotificationDispatchContext(
            delivery!.Id, clinic.TenantId, NotificationChannel.InApp, RecipientType.Staff, targetUserId, targetUserId.ToString("D"), "SystemNotice", "Body content", "en", "Notice", null
        );

        var result = await provider.SendAsync(dispatchCtx, CancellationToken.None);
        Assert.True(result.IsSuccess);

        // Target user can see in-app notification
        test.User.UserId = targetUserId;
        var unreadCount = await service.GetUnreadCountAsync(CancellationToken.None);
        Assert.Equal(1, unreadCount);

        var userNotifs = await service.GetUserNotificationsAsync(false, 10, CancellationToken.None);
        Assert.Single(userNotifs);
        Assert.Equal("SystemNotice", userNotifs.First().Title);

        // Other user cannot see target user's notification
        test.User.UserId = otherUserId;
        var otherNotifs = await service.GetUserNotificationsAsync(false, 10, CancellationToken.None);
        Assert.Empty(otherNotifs);

        // Other user cannot mark target user's notification as read
        var marked = await service.MarkAsReadAsync(userNotifs.First().Id, CancellationToken.None);
        Assert.False(marked);
    }

    [Fact]
    public async Task CrossTenantNotificationAndTemplateIsolationEnforced()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "tenant-a-notif", "admin@tenant-a-notif.example");
        var clinicB = await CreateClinicAsync(test, "tenant-b-notif", "admin@tenant-b-notif.example");

        // Create template in Tenant A
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<INotificationService>();
            await service.UpsertTemplateAsync(new UpsertNotificationTemplateCommand(
                "WelcomeTemplate", NotificationChannel.Email, "en", "Welcome", "Hello {{PatientName}}", true
            ), CancellationToken.None);
        }

        // Tenant B querying templates cannot see Tenant A template
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var templatesB = await service.GetTemplatesAsync(CancellationToken.None);
            Assert.Empty(templatesB);
        }
    }

    [Fact]
    public async Task IdempotencyKeyDeduplicationReturnsExistingDelivery()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "idemp-notif-clinic", "admin@idemp-notif.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var req = new NotificationRequest(
            NotificationChannel.Sms,
            RecipientType.Patient,
            Guid.NewGuid(),
            "+201011223344",
            "Reminder",
            "en",
            null,
            "Appointment",
            Guid.NewGuid(),
            "shared-idempotency-key-555"
        );

        var id1 = await service.EnqueueNotificationAsync(req, CancellationToken.None);
        var id2 = await service.EnqueueNotificationAsync(req, CancellationToken.None);

        Assert.Equal(id1, id2);
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"notification_test_{Guid.NewGuid():N}";
        await using (var conn = new NpgsqlConnection(masterConn))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE \"{databaseName}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(masterConn) { Database = databaseName };
        var connectionString = builder.ConnectionString;

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false"
        }).Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var tenant = new MutableTenant();
        var user = new MutableUser();
        var notifier = new CapturingNotifier();

        services.RemoveAll<IPlatformAccessContext>();
        services.RemoveAll<ISystemClock>();
        services.RemoveAll<IClinicInvitationNotifier>();
        services.RemoveAll<ICurrentTenant>();
        services.RemoveAll<ICurrentUser>();
        services.RemoveAll<IPermissionService>();

        services.AddSingleton<IPlatformAccessContext>(new PlatformAccess());
        services.AddSingleton<ISystemClock>(new FixedClock());
        services.AddSingleton<IClinicInvitationNotifier>(notifier);
        services.AddSingleton<ICurrentTenant>(tenant);
        services.AddSingleton<ICurrentUser>(user);
        services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        services.AddSingleton<IPermissionService, AllowAllPermissionService>();

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        return new TestContext(provider, tenant, user, connectionString, databaseName, fixture.Postgres.GetConnectionString());
    }

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear();
        test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        var clinics = scope.ServiceProvider.GetRequiredService<IClinicManagementService>();
        return await clinics.CreateAsync(new CreateClinicCommand(
            "Clinic " + slug, slug, "+20 1000", email, "Address", "Cairo", "Egypt", "Africa/Cairo", "EGP", email, null), CancellationToken.None);
    }

    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User, string ConnectionString, string DatabaseName, string MasterConnectionString) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            await Provider.DisposeAsync();
            await using var conn = new NpgsqlConnection(MasterConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{DatabaseName}\" WITH (FORCE);";
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class MutableTenant : ICurrentTenant { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "notification-integration"; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier { public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
    private sealed class AllowAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask; }
}
