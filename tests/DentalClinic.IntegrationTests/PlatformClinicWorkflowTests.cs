using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace DentalClinic.IntegrationTests;

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class PlatformDatabaseFixtureGroup : ICollectionFixture<PlatformPostgresFixture>
{
    public const string Name = "Platform database";
}

public sealed class PlatformPostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Postgres { get; } = new PostgreSqlBuilder("postgres:17-alpine").Build();
    public Task InitializeAsync() => Postgres.StartAsync();
    public Task DisposeAsync() => Postgres.DisposeAsync().AsTask();
}

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class PlatformClinicWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task PlatformAdminCanListClinics()
    {
        var test = await CreateTestContext();
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();
        await service.CreateAsync(Command(), CancellationToken.None);

        var result = await service.SearchAsync(new ClinicSearchQuery("bright"), CancellationToken.None);

        var clinic = Assert.Single(result.Items);
        Assert.Equal("Bright Smile", clinic.Name);
        Assert.Equal("admin@bright.example", clinic.AdminEmail);
    }

    [Fact]
    public async Task ClinicCreationCreatesOneTenantAndCorrectAdminAssociation()
    {
        var test = await CreateTestContext();
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();

        var result = await service.CreateAsync(Command(), CancellationToken.None);

        await using var context = CreateDbContext(test.ConnectionString);
        Assert.Equal(1, await context.Tenants.CountAsync());
        Assert.Equal(1, await context.TenantConfigurations.IgnoreQueryFilters().CountAsync());
        var admin = await context.Users.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(result.AdminUserId, admin.Id);
        Assert.Equal(result.TenantId, admin.TenantId);
        Assert.Null(admin.PasswordHash);
        var profile = await context.ClinicUsers.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(admin.Id, profile.Id);
        Assert.Equal(UserStatus.Invited, profile.Status);
        var role = await context.TenantRoles.IgnoreQueryFilters()
            .SingleAsync(x => x.NormalizedName == AuthConstants.ClinicAdminRoleNormalized);
        Assert.True(await context.UserRoleAssignments.IgnoreQueryFilters()
            .AnyAsync(x => x.UserId == admin.Id && x.RoleId == role.Id));
        Assert.Equal(3, await context.TenantRoles.IgnoreQueryFilters().CountAsync());
        Assert.Equal(2, await context.PlatformAuditLogs.CountAsync());
    }

    [Fact]
    public async Task FailedClinicInitializationRollsBackAllDatabaseChanges()
    {
        var test = await CreateTestContext(addFailingInitializer: true);
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();

        await Assert.ThrowsAsync<InitializationFailureException>(() =>
            service.CreateAsync(Command(), CancellationToken.None));

        await using var context = CreateDbContext(test.ConnectionString);
        Assert.Equal(0, await context.Tenants.CountAsync());
        Assert.Equal(0, await context.Users.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await context.TenantConfigurations.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await context.AdminInvitations.CountAsync());
        Assert.Equal(0, await context.ClinicUsers.IgnoreQueryFilters().CountAsync());
        Assert.Equal(0, await context.TenantRoles.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task InvitationTokenCannotBeReused()
    {
        var test = await CreateTestContext();
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();
        await service.CreateAsync(Command(), CancellationToken.None);

        var invitations = provider.GetRequiredService<IInvitationService>();
        var command = new AcceptInvitationCommand(test.Notifier.Token!, "A-strong-password-123!", "A-strong-password-123!");
        Assert.True(await invitations.AcceptAsync(command, CancellationToken.None));
        Assert.False(await invitations.AcceptAsync(command, CancellationToken.None));

        await using var context = CreateDbContext(test.ConnectionString);
        var invitation = await context.AdminInvitations.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(AdminInvitationStatus.Accepted, invitation.Status);
        Assert.Equal(4, await context.PlatformAuditLogs.CountAsync());
        Assert.Equal(UserStatus.Active, (await context.ClinicUsers.IgnoreQueryFilters().SingleAsync()).Status);
    }

    [Fact]
    public async Task ExpiredInvitationCannotBeAccepted()
    {
        var test = await CreateTestContext();
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();
        await service.CreateAsync(Command(), CancellationToken.None);
        test.Clock.UtcNow = Now.AddHours(49);

        var invitations = provider.GetRequiredService<IInvitationService>();
        Assert.False(await invitations.AcceptAsync(
            new AcceptInvitationCommand(test.Notifier.Token!, "A-strong-password-123!", "A-strong-password-123!"),
            CancellationToken.None));

        await using var context = CreateDbContext(test.ConnectionString);
        Assert.Equal(AdminInvitationStatus.Expired,
            (await context.AdminInvitations.IgnoreQueryFilters().SingleAsync()).Status);
    }

    [Fact]
    public async Task UpdatesAndStatusChangesAreAudited()
    {
        var test = await CreateTestContext();
        await using var provider = test.Provider;
        var service = provider.GetRequiredService<IClinicManagementService>();
        var created = await service.CreateAsync(Command(), CancellationToken.None);

        Assert.True(await service.UpdateAsync(new UpdateClinicCommand(
            created.TenantId, "Bright Smile Dental", "bright-smile", "+1 555 0101",
            "hello@bright.example", "2 Main Street", "Boston", "United States", "UTC", "USD", null),
            CancellationToken.None));
        Assert.True(await service.ChangeStatusAsync(created.TenantId, TenantStatus.Inactive, CancellationToken.None));
        Assert.True(await service.ChangeStatusAsync(created.TenantId, TenantStatus.Suspended, CancellationToken.None));
        Assert.True(await service.ChangeStatusAsync(created.TenantId, TenantStatus.Active, CancellationToken.None));

        await using var context = CreateDbContext(test.ConnectionString);
        var actions = await context.PlatformAuditLogs.Select(x => x.Action).ToListAsync();
        Assert.Contains(PlatformAuditAction.TenantUpdated, actions);
        Assert.Contains(PlatformAuditAction.TenantDeactivated, actions);
        Assert.Contains(PlatformAuditAction.TenantSuspended, actions);
        Assert.Contains(PlatformAuditAction.TenantActivated, actions);
    }

    private async Task<TestContext> CreateTestContext(bool addFailingInitializer = false)
    {
        var connectionBuilder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        {
            Database = $"platform_{Guid.NewGuid():N}",
            Pooling = false
        };
        var connectionString = connectionBuilder.ConnectionString;
        await using (var context = CreateDbContext(connectionString))
        {
            await context.Database.EnsureCreatedAsync();
        }

        var clock = new MutableClock { UtcNow = Now };
        var notifier = new CapturingNotifier();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false"
        }).Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        services.RemoveAll<IPlatformAccessContext>();
        services.RemoveAll<ISystemClock>();
        services.RemoveAll<IClinicInvitationNotifier>();
        services.AddSingleton<IPlatformAccessContext>(new PlatformAdminAccess());
        services.AddSingleton<ISystemClock>(clock);
        services.AddSingleton<IClinicInvitationNotifier>(notifier);
        if (addFailingInitializer)
        {
            services.AddScoped<ITenantInitializer, FailingInitializer>();
        }

        return new TestContext(services.BuildServiceProvider(), clock, notifier, connectionString);
    }

    private static ApplicationDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new ApplicationDbContext(options, new NoTenant(), new PlatformWriteScope());
    }

    private static CreateClinicCommand Command() => new(
        "Bright Smile", "bright-smile", "+1 555 0100", "hello@bright.example", "1 Main Street",
        "Boston", "United States", "UTC", "USD", "admin@bright.example", null);

    private sealed record TestContext(
        ServiceProvider Provider,
        MutableClock Clock,
        CapturingNotifier Notifier,
        string ConnectionString);
    private sealed class PlatformAdminAccess : IPlatformAccessContext
    {
        public bool IsPlatformAdmin => true;
        public Guid? UserId { get; } = Guid.NewGuid();
        public string? CorrelationId => "integration-test";
    }
    private sealed class MutableClock : ISystemClock { public DateTimeOffset UtcNow { get; set; } }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    {
        public string? Token { get; private set; }
        public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken)
        {
            Token = token;
            return Task.CompletedTask;
        }
    }
    private sealed class FailingInitializer : ITenantInitializer
    {
        public Task InitializeAsync(Tenant tenant, CancellationToken cancellationToken) =>
            throw new InitializationFailureException();
    }
    private sealed class InitializationFailureException : Exception;
    private sealed class NoTenant : ICurrentTenant
    {
        public Guid? TenantId => null;
        public bool IsAvailable => false;
        public Guid RequireTenantId() => throw new InvalidOperationException();
    }
}
