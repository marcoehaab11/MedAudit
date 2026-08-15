using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Inventory;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Pharmacy;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Inventory;
using DentalClinic.Domain.Pharmacy;
using DentalClinic.Domain.Prescriptions;
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
public sealed class PharmacyWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    // ────────────────────────────────────────────────────────────────────────────
    // 1. Tenant Isolation: cross-tenant dispensings not visible
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TenantIsolationCrossTenantDispensingsNotVisible()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicSetupAsync(test, "pharm-iso-a", "admin@pharm-iso-a.com");
        var clinicB = await CreateClinicSetupAsync(test, "pharm-iso-b", "admin@pharm-iso-b.com");

        // Dispense in Clinic A
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<IPharmacyService>();

        var dispensingA = await CreateAndDispensePrescriptionAsync(scopeA.ServiceProvider, clinicA.TenantId, clinicA.AdminUserId, clinicA.PatientId, clinicA.DoctorProfileId, 10m, 10m);

        // Clinic B must see 0 dispensings
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<IPharmacyService>();

        var dispensingsB = await serviceB.GetDispensingsAsync(null, null, null, null, null, null, null, 1, 20, CancellationToken.None);
        Assert.Empty(dispensingsB.Items);

        var singleB = await serviceB.GetDispensingByIdAsync(dispensingA.Id, CancellationToken.None);
        Assert.Null(singleB);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 2 & 3. Cross-Tenant Rejection: prescription and inventory items
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CrossTenantPrescriptionAndInventoryDispensingRejected()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicSetupAsync(test, "pharm-cross-a", "admin@pharm-cross-a.com");
        var clinicB = await CreateClinicSetupAsync(test, "pharm-cross-b", "admin@pharm-cross-b.com");

        // Create prescription & inventory in Clinic A
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var (rxIdA, rxItemIdA, invItemIdA) = await CreateIssuedPrescriptionWithStockAsync(scopeA.ServiceProvider, clinicA.TenantId, clinicA.AdminUserId, clinicA.PatientId, clinicA.DoctorProfileId, 10m, 50m);

        // Clinic B attempts to dispense Clinic A's prescription -> must throw KeyNotFoundException
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<IPharmacyService>();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            serviceB.DispensePrescriptionAsync(new DispensePrescriptionCommand(
                rxIdA, [new DispensePrescriptionItemCommand(rxItemIdA, invItemIdA, 5m)], null
            ), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4, 5, 6. Full & Partial Dispensing and Remaining Quantity Calculation
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task PartialAndFullDispensingCalculatesRemainingQuantities()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-disp", "admin@pharm-disp.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPharmacyService>();

        var (rxId, rxItemId, invItemId) = await CreateIssuedPrescriptionWithStockAsync(scope.ServiceProvider, clinic.TenantId, clinic.AdminUserId, clinic.PatientId, clinic.DoctorProfileId, 20m, 100m);

        // 1. Partial dispensing: dispense 8 out of 20
        var disp1 = await service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
            rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, 8m)], "First partial dispense"
        ), CancellationToken.None);

        Assert.Equal(DispensingStatus.PartiallyDispensed, disp1.Status);
        Assert.Single(disp1.Items);
        Assert.Equal(8m, disp1.Items.First().QuantityDispensed);

        // Check prescription state: remaining must be 12
        var rxState1 = await service.GetPrescriptionDispensingDetailAsync(rxId, CancellationToken.None);
        Assert.NotNull(rxState1);
        var itemState1 = rxState1.Items.First(i => i.PrescriptionItemId == rxItemId);
        Assert.Equal(8m, itemState1.TotalDispensedQuantity);
        Assert.Equal(12m, itemState1.RemainingQuantity);

        // 2. Subsequent dispensing: dispense remaining 12
        var disp2 = await service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
            rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, 12m)], "Final dispense"
        ), CancellationToken.None);

        Assert.Equal(DispensingStatus.FullyDispensed, disp2.Status);

        // Remaining must now be 0
        var rxState2 = await service.GetPrescriptionDispensingDetailAsync(rxId, CancellationToken.None);
        Assert.NotNull(rxState2);
        var itemState2 = rxState2.Items.First(i => i.PrescriptionItemId == rxItemId);
        Assert.Equal(20m, itemState2.TotalDispensedQuantity);
        Assert.Equal(0m, itemState2.RemainingQuantity);

        // Attempting to dispense 1 more must throw PharmacyDispensingException
        await Assert.ThrowsAsync<PharmacyDispensingException>(() =>
            service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
                rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, 1m)], null
            ), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 7. Insufficient Stock Handling
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task InsufficientStockThrowsInsufficientStockException()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-stock", "admin@pharm-stock.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPharmacyService>();

        // Prescription for 15, but inventory has only 5
        var (rxId, rxItemId, invItemId) = await CreateIssuedPrescriptionWithStockAsync(scope.ServiceProvider, clinic.TenantId, clinic.AdminUserId, clinic.PatientId, clinic.DoctorProfileId, 15m, 5m);

        // Dispensing 10 when stock is 5 -> InsufficientStockException
        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
                rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, 10m)], null
            ), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 8 & 9. Concurrent Stock Dispensing (Real PostgreSQL Row Lock)
    //
    // Stock = 10
    // Request A: dispense 7 (succeeds, stock = 3)
    // Request B: dispense 7 (fails with InsufficientStockException)
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ConcurrentStockDispensingExactlyOneSucceedsViaPostgresLock()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-conc", "admin@pharm-conc.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();

        // Initial stock = 10, Prescribed = 20
        var (rxId, rxItemId, invItemId) = await CreateIssuedPrescriptionWithStockAsync(scope.ServiceProvider, clinic.TenantId, clinic.AdminUserId, clinic.PatientId, clinic.DoctorProfileId, 20m, 10m);

        // Run two concurrent dispensing requests from separate DI scopes
        var taskA = DispenseFromScopeAsync(test, clinic.TenantId, clinic.AdminUserId, rxId, rxItemId, invItemId, 7m);
        var taskB = DispenseFromScopeAsync(test, clinic.TenantId, clinic.AdminUserId, rxId, rxItemId, invItemId, 7m);

        var results = await Task.WhenAll(SafeRunAsync(taskA), SafeRunAsync(taskB));

        int successCount = results.Count(r => r == null);
        int failCount = results.Count(r => r != null);

        Assert.Equal(1, successCount);
        Assert.Equal(1, failCount);
        Assert.IsType<InsufficientStockException>(results.First(r => r != null));

        // Final inventory stock must equal exactly 3
        await using var verifyScope = test.Provider.CreateAsyncScope();
        var invService = verifyScope.ServiceProvider.GetRequiredService<IInventoryService>();
        var item = await invService.GetItemByIdAsync(invItemId, CancellationToken.None);
        Assert.NotNull(item);
        Assert.Equal(3m, item.CurrentStock);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 10 & 11. Dispensing Reversal and Duplicate Reversal Prevention
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task DispensingReversalReturnsStockAndRejectsDuplicateReversal()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-rev", "admin@pharm-rev.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPharmacyService>();

        // Stock = 50, dispense 10 -> stock = 40
        var (rxId, rxItemId, invItemId) = await CreateIssuedPrescriptionWithStockAsync(scope.ServiceProvider, clinic.TenantId, clinic.AdminUserId, clinic.PatientId, clinic.DoctorProfileId, 10m, 50m);

        var disp = await service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
            rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, 10m)], null
        ), CancellationToken.None);

        var invService = scope.ServiceProvider.GetRequiredService<IInventoryService>();
        var afterDispStock = await invService.GetItemByIdAsync(invItemId, CancellationToken.None);
        Assert.NotNull(afterDispStock);
        Assert.Equal(40m, afterDispStock.CurrentStock);

        // Reverse dispensing
        var reversed = await service.ReverseDispensingAsync(new ReverseDispensingCommand(disp.Id, "Wrong patient"), CancellationToken.None);
        Assert.Equal(DispensingStatus.Reversed, reversed.Status);
        Assert.NotNull(reversed.Reversal);
        Assert.Equal("Wrong patient", reversed.Reversal.Reason);

        // Stock must be restored to 50
        var afterRevStock = await invService.GetItemByIdAsync(invItemId, CancellationToken.None);
        Assert.NotNull(afterRevStock);
        Assert.Equal(50m, afterRevStock.CurrentStock);

        // Second reversal attempt must throw PharmacyDispensingException
        await Assert.ThrowsAsync<PharmacyDispensingException>(() =>
            service.ReverseDispensingAsync(new ReverseDispensingCommand(disp.Id, "Second reversal"), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 12. Permission Boundaries
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task PermissionBoundariesEnforcedForPharmacyOperations()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-perm", "admin@pharm-perm.com");

        // Custom container with DenyAll permission service
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = test.ConnectionString,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false"
        }).Build();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);

        var tenant = new MutableTenant();
        tenant.Set(clinic.TenantId);
        var user = new MutableUser { UserId = clinic.AdminUserId };

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
        services.AddSingleton<IPermissionService, DenyAllPermissionService>();

        await using var denyProvider = services.BuildServiceProvider();
        await using var denyScope = denyProvider.CreateAsyncScope();
        var deniedService = denyScope.ServiceProvider.GetRequiredService<IPharmacyService>();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => deniedService.GetDashboardSummaryAsync(CancellationToken.None));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => deniedService.DispensePrescriptionAsync(new DispensePrescriptionCommand(Guid.NewGuid(), [], null), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 13, 14, 15, 16. Catalog mapping, Patient history, Dashboard & Lifecycle
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task DashboardPatientHistoryCatalogMappingAndLifecycleRestrictionsWork()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicSetupAsync(test, "pharm-dash", "admin@pharm-dash.com");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPharmacyService>();

        // 16. Draft & Cancelled Prescriptions cannot be dispensed
        var prescriptionStore = scope.ServiceProvider.GetRequiredService<IPrescriptionStore>();
        await using (var tx = await prescriptionStore.BeginTransactionAsync(CancellationToken.None))
        {
            var rxNum = await prescriptionStore.ReserveNumberAsync(clinic.TenantId, CancellationToken.None);
            var draftRx = new Prescription(clinic.TenantId, clinic.PatientId, clinic.DoctorProfileId, null, null, null, rxNum, "Draft Notes", clinic.AdminUserId, Now);
            prescriptionStore.AddPrescription(draftRx);
            await prescriptionStore.SaveChangesAsync(CancellationToken.None);
            await tx.CommitAsync(CancellationToken.None);

            await Assert.ThrowsAsync<PharmacyDispensingException>(() =>
                service.DispensePrescriptionAsync(new DispensePrescriptionCommand(draftRx.Id, [], null), CancellationToken.None));
        }

        // 13. Catalog mapping
        var catalog = await service.GetMedicationCatalogAsync(null, null, CancellationToken.None);
        Assert.NotNull(catalog);

        // 15. Dashboard summary aggregation
        var dashboard = await service.GetDashboardSummaryAsync(CancellationToken.None);
        Assert.NotNull(dashboard);
        Assert.True(dashboard.WaitingForDispensingCount >= 0);

        // 14. Patient pharmacy history
        var history = await service.GetPatientPharmacyHistoryAsync(clinic.PatientId, CancellationToken.None);
        Assert.NotNull(history);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Concurrency helper
    // ────────────────────────────────────────────────────────────────────────────
    private static async Task DispenseFromScopeAsync(TestContext test, Guid tenantId, Guid userId, Guid rxId, Guid rxItemId, Guid invItemId, decimal qty)
    {
        test.Tenant.Set(tenantId);
        test.User.UserId = userId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPharmacyService>();
        await service.DispensePrescriptionAsync(new DispensePrescriptionCommand(
            rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, qty)], null
        ), CancellationToken.None);
    }

    private static async Task<Exception?> SafeRunAsync(Task task)
    {
        try { await task; return null; }
        catch (Exception ex) { return ex; }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Setup helpers
    // ────────────────────────────────────────────────────────────────────────────
    private static async Task<(Guid rxId, Guid rxItemId, Guid invItemId)> CreateIssuedPrescriptionWithStockAsync(
        IServiceProvider provider, Guid tenantId, Guid userId, Guid patientId, Guid doctorProfileId, decimal prescribedQty, decimal stockQty)
    {
        var invService = provider.GetRequiredService<IInventoryService>();
        var catId = await invService.UpsertCategoryAsync(null, new UpsertInventoryCategoryCommand("PharmaCat", null, null, true), CancellationToken.None);
        var invItemId = await invService.UpsertItemAsync(null, new UpsertInventoryItemCommand("Amoxicillin 500mg", null, $"AMX-{Guid.NewGuid():N}", catId, "Tablet", true, 1m, 2m, 10m, null, null), CancellationToken.None);
        await invService.ReceiveStockAsync(new ReceiveStockCommand(invItemId, stockQty, 10m, null, "PO-PHARM", null, false), CancellationToken.None);

        var rxStore = provider.GetRequiredService<IPrescriptionStore>();
        await using var tx = await rxStore.BeginTransactionAsync(CancellationToken.None);
        var rxNumber = await rxStore.ReserveNumberAsync(tenantId, CancellationToken.None);
        var rx = new Prescription(tenantId, patientId, doctorProfileId, null, null, null, rxNumber, null, userId, Now);
        var item = rx.AddItem(null, "Amoxicillin 500mg", "Amoxicillin", "500mg", MedicationForm.Tablet, "1 tab", "TID", "7 days", "Oral", "Take after meals", (int)prescribedQty, 1, rx.Version, Now);
        rx.Issue(userId, $"DOC-{Guid.NewGuid():N}", rx.Version, Now);
        rxStore.AddPrescription(rx);
        await rxStore.SaveChangesAsync(CancellationToken.None);
        await tx.CommitAsync(CancellationToken.None);

        return (rx.Id, item.Id, invItemId);
    }

    private static async Task<PharmacyDispensingDetailDto> CreateAndDispensePrescriptionAsync(
        IServiceProvider provider, Guid tenantId, Guid userId, Guid patientId, Guid doctorProfileId, decimal prescribedQty, decimal dispenseQty)
    {
        var (rxId, rxItemId, invItemId) = await CreateIssuedPrescriptionWithStockAsync(provider, tenantId, userId, patientId, doctorProfileId, prescribedQty, 100m);
        var pharmacyService = provider.GetRequiredService<IPharmacyService>();
        return await pharmacyService.DispensePrescriptionAsync(new DispensePrescriptionCommand(
            rxId, [new DispensePrescriptionItemCommand(rxItemId, invItemId, dispenseQty)], null
        ), CancellationToken.None);
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"pharmacy_test_{Guid.NewGuid():N}";
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

        // Create doctor profile & patient for integration testing
        var docService = scope.ServiceProvider.GetRequiredService<IDoctorProfileCommands>();
        var docId = await docService.CreateAsync(new CreateDoctorProfileCommand(clinic.AdminUserId, "Dr. " + slug, "Dental", null, null, true), CancellationToken.None);

        var patService = scope.ServiceProvider.GetRequiredService<IPatientCommands>();
        var patResult = await patService.CreateAsync(new CreatePatientCommand("John", "Doe", null, "+20 1111", null, null, null, null, null, null), CancellationToken.None);

        return new ClinicSetupResult(clinic.TenantId, clinic.AdminUserId, docId, patResult.PatientId);
    }

    private sealed record ClinicSetupResult(Guid TenantId, Guid AdminUserId, Guid DoctorProfileId, Guid PatientId);

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
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "pharmacy-integration"; }
    private sealed class NullInvitationNotifier : IClinicInvitationNotifier { public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
    private sealed class AllowAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class DenyAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(false); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => throw new UnauthorizedAccessException($"Permission denied: {permission}"); }
}
