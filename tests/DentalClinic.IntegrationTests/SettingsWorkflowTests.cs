using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Xunit;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class SettingsWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 16, 10, 0, 0, TimeSpan.Zero);

    // ────────────────────────────────────────────────────────────────────────────
    // 1. Tenant Isolation: cross-tenant settings and holidays not visible
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TenantIsolationSettingsAndHolidaysNotVisibleCrossTenant()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicSetupAsync(test, "set-iso-a", "admin@set-iso-a.com");
        var clinicB = await CreateClinicSetupAsync(test, "set-iso-b", "admin@set-iso-b.com");

        // Update branding & add holiday in Clinic A
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<ISettingsService>();

        var currentA = await serviceA.GetSettingsAsync(CancellationToken.None);
        await serviceA.UpdateBrandingAsync(new UpdateBrandingCommand("#1e40af", "#0284c7", "#f59e0b", "ar", "en,ar", true, currentA.Version), CancellationToken.None);

        var holidayA = await serviceA.CreateClinicHolidayAsync(new UpsertClinicHolidayCommand(
            "Eid Al-Fitr", "عيد الفطر", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 3), null, null, "Public Holiday", true, true
        ), CancellationToken.None);

        // Clinic B checks settings: must see Clinic B default branding & 0 holidays
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<ISettingsService>();

        var settingsB = await serviceB.GetSettingsAsync(CancellationToken.None);
        Assert.NotEqual("ar", settingsB.DefaultLanguage);
        Assert.False(settingsB.RtlEnabled);

        var holidaysB = await serviceB.GetClinicHolidaysAsync(CancellationToken.None);
        Assert.Empty(holidaysB);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 2. Cross-Tenant Rejection
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CrossTenantSettingsUpdateRejected()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicSetupAsync(test, "set-cross-a", "admin@set-cross-a.com");
        var clinicB = await CreateClinicSetupAsync(test, "set-cross-b", "admin@set-cross-b.com");

        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<ISettingsService>();
        var holidayA = await serviceA.CreateClinicHolidayAsync(new UpsertClinicHolidayCommand(
            "New Year", "رأس السنة", new DateOnly(2027, 1, 1), new DateOnly(2027, 1, 1), null, null, null, true, true
        ), CancellationToken.None);

        // Clinic B attempts to update or delete Clinic A's holiday -> KeyNotFoundException
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<ISettingsService>();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            serviceB.UpdateClinicHolidayAsync(holidayA.Id, new UpsertClinicHolidayCommand("Hacked", null, new DateOnly(2027, 1, 1), new DateOnly(2027, 1, 1), null, null, null, true, true), CancellationToken.None));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            serviceB.DeleteClinicHolidayAsync(holidayA.Id, CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 3. Settings Persistence & Retrieval
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task SettingsPersistenceAndRetrievalWorksAcrossSections()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "set-pers", "admin@set-pers.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISettingsService>();

        var s0 = await service.GetSettingsAsync(CancellationToken.None);

        // 1. Profile
        var s1 = await service.UpdateClinicProfileAsync(new UpdateClinicProfileCommand(
            "MedDentist Premium", "عيادة ميدي دنتست", "+20 1000", "+20 1001", "admin@med.com", "https://meddentist.com",
            "123 Street", "شارع ١٢٣", "Cairo", "Egypt", "TAX-999", "Premium Dental Care", "عناية أسنان متميزة", null, null, s0.Version
        ), CancellationToken.None);

        Assert.Equal("MedDentist Premium", s1.ClinicName);
        Assert.Equal("عيادة ميدي دنتست", s1.ArabicName);
        Assert.Equal("TAX-999", s1.TaxNumber);

        // 2. Prescription Settings
        var s2 = await service.UpdatePrescriptionSettingsAsync(new UpdatePrescriptionSettingsCommand(
            "CLINIC-RX-", "ar", "ar", true, true, true, s1.Version
        ), CancellationToken.None);

        Assert.Equal("CLINIC-RX-", s2.PrescriptionPrefix);
        Assert.Equal("ar", s2.DefaultPrescriptionLanguage);

        // 3. Inventory & Pharmacy Settings
        var s3 = await service.UpdateInventorySettingsAsync(new UpdateInventorySettingsCommand(
            false, true, true, s2.Version
        ), CancellationToken.None);
        Assert.True(s3.RequireSupplierOnReceipt);

        var s4 = await service.UpdatePharmacySettingsAsync(new UpdatePharmacySettingsCommand(
            true, true, true, true, s3.Version
        ), CancellationToken.None);
        Assert.True(s4.RequirePharmacistRoleForDispensing);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4. Optimistic Concurrency Protection
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task OptimisticConcurrencyStaleVersionTriggersInvalidOperationException()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "set-conc", "admin@set-conc.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISettingsService>();

        var initial = await service.GetSettingsAsync(CancellationToken.None);
        var staleVersion = initial.Version;

        // Admin A updates settings
        await service.UpdateBrandingAsync(new UpdateBrandingCommand("#112233", "#445566", "#778899", "en", "en,ar", false, initial.Version), CancellationToken.None);

        // Admin B attempts save with stale version -> InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UpdateBrandingAsync(new UpdateBrandingCommand("#998877", "#665544", "#332211", "en", "en,ar", false, staleVersion), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 5. Clinic Working Hours & Overlapping Period Rejection
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ClinicWorkingHoursPersistAndRejectOverlappingPeriods()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "set-hours", "admin@set-hours.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISettingsService>();

        // Valid working hours setup
        var validCommand = new UpdateClinicHoursCommand([
            new ClinicHoursDto(DayOfWeek.Monday, true, [
                new ClinicHourPeriodDto("08:00", "12:00", ClinicPeriodType.Work),
                new ClinicHourPeriodDto("13:00", "17:00", ClinicPeriodType.Work)
            ]),
            new ClinicHoursDto(DayOfWeek.Sunday, false, [])
        ]);

        var updated = await service.UpdateClinicHoursAsync(validCommand, CancellationToken.None);
        Assert.Equal(2, updated.Count);

        // Overlapping periods on same day -> ArgumentException
        var invalidCommand = new UpdateClinicHoursCommand([
            new ClinicHoursDto(DayOfWeek.Monday, true, [
                new ClinicHourPeriodDto("08:00", "14:00", ClinicPeriodType.Work),
                new ClinicHourPeriodDto("13:00", "17:00", ClinicPeriodType.Work)
            ])
        ]);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UpdateClinicHoursAsync(invalidCommand, CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 6. Clinic Holiday CRUD
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ClinicHolidayCrudOperationsWork()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "set-hol", "admin@set-hol.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISettingsService>();

        // Create
        var created = await service.CreateClinicHolidayAsync(new UpsertClinicHolidayCommand(
            "Revolution Day", "ثورة 23 يوليو", new DateOnly(2026, 7, 23), new DateOnly(2026, 7, 23), null, null, "National Holiday", true, true
        ), CancellationToken.None);

        Assert.Equal("Revolution Day", created.Name);

        // Read list
        var list = await service.GetClinicHolidaysAsync(CancellationToken.None);
        Assert.Single(list);

        // Update
        var updated = await service.UpdateClinicHolidayAsync(created.Id, new UpsertClinicHolidayCommand(
            "Revolution Day Updated", "ثورة 23 يوليو معدلة", new DateOnly(2026, 7, 23), new DateOnly(2026, 7, 24), null, null, "Extended Holiday", true, true
        ), CancellationToken.None);

        Assert.Equal("Revolution Day Updated", updated.Name);
        Assert.Equal(new DateOnly(2026, 7, 24), updated.EndDate);

        // Delete
        await service.DeleteClinicHolidayAsync(created.Id, CancellationToken.None);
        var emptyList = await service.GetClinicHolidaysAsync(CancellationToken.None);
        Assert.Empty(emptyList);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 7. User Preferences Persistence
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task UserPreferencesPersistPerUser()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "set-pref", "admin@set-pref.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ISettingsService>();

        var defaultPref = await service.GetUserPreferenceAsync(CancellationToken.None);
        Assert.Equal("en", defaultPref.Language);
        Assert.Equal("Light", defaultPref.Theme);

        var updated = await service.UpdateUserPreferenceAsync(new UpdateUserPreferenceCommand(
            "ar", "Dark", "DD/MM/YYYY", "12h", 6, "timeGridDay"
        ), CancellationToken.None);

        Assert.Equal("ar", updated.Language);
        Assert.Equal("Dark", updated.Theme);
        Assert.Equal(6, updated.StartOfWeek);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Setup helpers
    // ────────────────────────────────────────────────────────────────────────────
    private async Task<TestContext> CreateContextAsync()
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"settings_test_{Guid.NewGuid():N}";
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

        services.RemoveAll<IPlatformAccessContext>();
        services.RemoveAll<ISystemClock>();
        services.RemoveAll<IClinicInvitationNotifier>();
        services.RemoveAll<ICurrentTenant>();
        services.RemoveAll<ICurrentUser>();
        services.RemoveAll<IPermissionService>();

        services.AddSingleton<IPlatformAccessContext>(new PlatformAccess());
        services.AddSingleton<ISystemClock>(new FixedClock());
        services.AddSingleton<IClinicInvitationNotifier, NullInvitationNotifier>();
        services.AddSingleton<ICurrentTenant>(tenant);
        services.AddSingleton<ICurrentUser>(user);
        services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        services.AddSingleton<IPermissionService, AllowAllPermissionService>();

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        return new TestContext(provider, tenant, user, connectionString, databaseName, masterConn);
    }

    private static async Task<ClinicSetupResult> CreateClinicSetupAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear();
        test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        var clinics = scope.ServiceProvider.GetRequiredService<IClinicManagementService>();
        var clinic = await clinics.CreateAsync(new CreateClinicCommand(
            "Clinic " + slug, slug, "+20 1000", email, "Address", "Cairo", "Egypt", "Africa/Cairo", "EGP", email, null
        ), CancellationToken.None);

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        return new ClinicSetupResult(clinic.TenantId, clinic.AdminUserId);
    }

    private sealed record ClinicSetupResult(Guid TenantId, Guid AdminUserId);

    private sealed record TestContext(
        ServiceProvider Provider,
        MutableTenant Tenant,
        MutableUser User,
        string ConnectionString,
        string DatabaseName,
        string MasterConnectionString
    ) : IAsyncDisposable
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
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "settings-integration"; }
    private sealed class NullInvitationNotifier : IClinicInvitationNotifier { public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
    private sealed class AllowAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask; }
}
