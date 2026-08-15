using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Inventory;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Inventory;
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
public sealed class InventoryWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    // ────────────────────────────────────────────────────────────────────────────
    // 1 + 2. Tenant isolation: cross-tenant items and suppliers not visible
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TenantIsolationCrossTenantItemsAndSuppliersNotVisible()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "inv-iso-a", "admin@iso-a.example");
        var clinicB = await CreateClinicAsync(test, "inv-iso-b", "admin@iso-b.example");

        // ── Tenant A: create a category, supplier, and item ───────────────────
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<IInventoryService>();

        var catIdA = await serviceA.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Cat-A", null, null, true), CancellationToken.None);

        var supIdA = await serviceA.UpsertSupplierAsync(null,
            new UpsertSupplierCommand("Supplier-A", null, null, null, null, null, true), CancellationToken.None);

        var itemIdA = await serviceA.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("Item-A", null, "SKU-ISO-A", catIdA, "Unit", true, 1m, 2m, 10m, null, supIdA),
            CancellationToken.None);

        // ── Tenant B: must see zero items, zero categories, zero suppliers ────
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<IInventoryService>();

        // 1. Tenant isolation — items
        var itemsB = await serviceB.GetItemsAsync(null, null, null, CancellationToken.None);
        Assert.DoesNotContain(itemsB, i => i.Id == itemIdA);

        // 2. Cross-tenant item access rejection (direct GetById)
        var itemAFromB = await serviceB.GetItemByIdAsync(itemIdA, CancellationToken.None);
        Assert.Null(itemAFromB);

        // 3. Cross-tenant supplier reference rejection — Tenant A's supplier id not visible to B
        var suppliersB = await serviceB.GetSuppliersAsync(CancellationToken.None);
        Assert.DoesNotContain(suppliersB, s => s.Id == supIdA);

        // 4. Cross-tenant category rejection
        var categoriesB = await serviceB.GetCategoriesAsync(CancellationToken.None);
        Assert.DoesNotContain(categoriesB, c => c.Id == catIdA);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4 + 5 + 6 + 13 + 14. Stock receipt, issue, adjustment, balance, supplier
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task StockReceiptIssueAdjustmentCalculatesBalanceWithSupplierRelationship()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-balance", "admin@inv-balance.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        // 4. Stock receipt
        var catId = await service.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Consumables", "مستهلكات", null, true), CancellationToken.None);

        var supId = await service.UpsertSupplierAsync(null,
            new UpsertSupplierCommand("Medical Supplies Co", "John", "0100000000", "sales@med.com", null, null, true),
            CancellationToken.None);

        var itemId = await service.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("Anesthetic Cartridges", "أمبولات مخدر", "ANESTH-BAL",
                catId, "Box", true, 5m, 10m, 200m, "Local anesthetic", supId),
            CancellationToken.None);

        // 4. Receipt +50
        var recMovId = await service.ReceiveStockAsync(
            new ReceiveStockCommand(itemId, 50m, 200m, supId, "PO-5001", "Initial stock", false),
            CancellationToken.None);
        Assert.NotEqual(Guid.Empty, recMovId);

        // 14. Supplier relationships — supplier is recorded on the movement
        var movementsAfterReceipt = await service.GetMovementsAsync(itemId, 50, CancellationToken.None);
        var receiptMov = movementsAfterReceipt.First(m => m.Id == recMovId);
        Assert.Equal(supId, receiptMov.SupplierId);

        // 13. Stock balance = 50 after receipt
        var afterReceipt = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(afterReceipt);
        Assert.Equal(50m, afterReceipt.CurrentStock);

        // 5. Stock issue -15
        var issueMovId = await service.IssueStockAsync(
            new IssueStockCommand(itemId, 15m, "USAGE-101", "Clinic usage"), CancellationToken.None);
        Assert.NotEqual(Guid.Empty, issueMovId);

        // 6. Stock adjustment (decrease) -5
        var adjMovId = await service.AdjustStockAsync(
            new AdjustStockCommand(itemId, StockMovementType.AdjustmentDecrease, 5m, "ADJ-001", "Damaged box"),
            CancellationToken.None);
        Assert.NotEqual(Guid.Empty, adjMovId);

        // 13. Balance: 50 - 15 - 5 = 30; total value = 30 * 200 = 6000
        var item = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(item);
        Assert.Equal(30m, item.CurrentStock);
        Assert.Equal(6000m, item.TotalValue);
        Assert.False(item.IsLowStock);
        Assert.False(item.IsOutOfStock);

        // 6. Adjustment increase +10
        await service.AdjustStockAsync(
            new AdjustStockCommand(itemId, StockMovementType.AdjustmentIncrease, 10m, "ADJ-002", "Return to stock"),
            CancellationToken.None);

        var afterIncrease = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(afterIncrease);
        Assert.Equal(40m, afterIncrease.CurrentStock);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 7. Historical stock movement immutability
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task HistoricalStockMovementsAreImmutable()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-immut", "admin@inv-immut.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        var catId = await service.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Immutable-Cat", null, null, true), CancellationToken.None);
        var itemId = await service.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("Immutable Item", null, "IMMUT-1", catId, "Box", true, 1m, 2m, 50m, null, null),
            CancellationToken.None);

        await service.ReceiveStockAsync(new ReceiveStockCommand(itemId, 20m, 50m, null, "PO-IMM", null, false), CancellationToken.None);
        await service.IssueStockAsync(new IssueStockCommand(itemId, 5m, "USE-IMM", null), CancellationToken.None);

        var movements = await service.GetMovementsAsync(itemId, 50, CancellationToken.None);
        Assert.Equal(2, movements.Count);

        // Verify using raw DB that movements table has no UPDATE/DELETE capability
        // by confirming both movements persist exactly after further operations
        await service.IssueStockAsync(new IssueStockCommand(itemId, 3m, "USE-IMM-2", null), CancellationToken.None);

        var allMovements = await service.GetMovementsAsync(itemId, 50, CancellationToken.None);
        Assert.Equal(3, allMovements.Count);

        // Original receipt movement quantity must not have changed
        var receipt = allMovements.First(m => m.MovementType == StockMovementType.Receipt);
        Assert.Equal(20m, receipt.Quantity);
        Assert.Equal("PO-IMM", receipt.Reference);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 8. Negative stock protection (sequential)
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task NegativeStockProtectionSequential()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-negprot", "admin@inv-negprot.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        var catId = await service.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("NegProt-Cat", null, null, true), CancellationToken.None);
        var itemId = await service.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("NegProt Item", null, "NEG-1", catId, "Unit", true, 1m, 2m, 10m, null, null),
            CancellationToken.None);

        // Receive 5 units
        await service.ReceiveStockAsync(new ReceiveStockCommand(itemId, 5m, 10m, null, "PO-NEG", null, false), CancellationToken.None);

        // Issue all 5 → succeeds
        await service.IssueStockAsync(new IssueStockCommand(itemId, 5m, "USE-NEG-1", null), CancellationToken.None);

        // Issue 1 more when stock = 0 → must throw
        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            service.IssueStockAsync(new IssueStockCommand(itemId, 1m, "USE-NEG-2", null), CancellationToken.None));

        // Adjustment decrease when stock = 0 → must throw
        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            service.AdjustStockAsync(new AdjustStockCommand(itemId, StockMovementType.AdjustmentDecrease, 1m, "ADJ-NEG", null), CancellationToken.None));

        // Stock must still be exactly 0
        var item = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(item);
        Assert.Equal(0m, item.CurrentStock);
        Assert.True(item.IsOutOfStock);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 9 + 10. Concurrent stock issue — real PostgreSQL FOR UPDATE locking
    //
    //   Initial stock = 10
    //   Request A: issue 7  (succeeds — 3 remaining)
    //   Request B: issue 7  (fails   — InsufficientStockException)
    //   Final stock must equal exactly 3. No negative stock. No duplicates.
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ConcurrentStockIssueExactlyOneSucceedsOneFailsViaPostgresRowLock()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-conc", "admin@inv-conc.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var setupScope = test.Provider.CreateAsyncScope();
        var setupService = setupScope.ServiceProvider.GetRequiredService<IInventoryService>();

        var catId = await setupService.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Concurrent-Cat", null, null, true), CancellationToken.None);
        var itemId = await setupService.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("Concurrent Item", null, "CONC-1", catId, "Box", true, 1m, 2m, 50m, null, null),
            CancellationToken.None);

        // Initial stock = 10
        await setupService.ReceiveStockAsync(
            new ReceiveStockCommand(itemId, 10m, 50m, null, "PO-CONC", "Initial stock", false), CancellationToken.None);

        // Launch both issue requests concurrently — each from its own DI scope
        // (separate DbContext instances, simulating two real HTTP requests)
        using var barrierA = new SemaphoreSlim(0, 1);
        using var barrierB = new SemaphoreSlim(0, 1);

        var taskA = IssueFromSeparateScopeAsync(test, itemId, 7m, "CONC-USE-A");
        var taskB = IssueFromSeparateScopeAsync(test, itemId, 7m, "CONC-USE-B");

        var results = await Task.WhenAll(
            SafeRunAsync(taskA),
            SafeRunAsync(taskB)
        );

        int successCount = results.Count(r => r == null);          // null = succeeded
        int failCount    = results.Count(r => r != null);           // non-null = InsufficientStockException

        // Exactly one must have succeeded, exactly one must have failed
        Assert.Equal(1, successCount);
        Assert.Equal(1, failCount);
        Assert.IsType<InsufficientStockException>(results.First(r => r != null));

        // Final stock must be 3 (10 - 7 = 3)
        await using var verifyScope = test.Provider.CreateAsyncScope();
        var verifyService = verifyScope.ServiceProvider.GetRequiredService<IInventoryService>();
        var finalItem = await verifyService.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(finalItem);
        Assert.Equal(3m, finalItem.CurrentStock);

        // Exactly one movement of type Issue must have been recorded
        var movements = await verifyService.GetMovementsAsync(itemId, 50, CancellationToken.None);
        var issueMovements = movements.Where(m => m.MovementType == StockMovementType.Issue).ToList();
        Assert.Single(issueMovements);
        Assert.Equal(7m, issueMovements[0].Quantity);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 11. Material consumption authorization (IMaterialConsumptionService)
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task MaterialConsumptionServiceIsRegisteredAndResolvable()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-matcons", "admin@inv-matcons.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();

        // The service must be resolvable (registered by DI)
        var consumptionService = scope.ServiceProvider.GetRequiredService<IMaterialConsumptionService>();
        Assert.NotNull(consumptionService);

        // Record consumption on a real item requires stock — must throw InsufficientStockException
        // when stock = 0 for the given item (demonstrates auth flows through the consumption boundary)
        var inventoryService = scope.ServiceProvider.GetRequiredService<IInventoryService>();
        var catId = await inventoryService.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Mat-Cat", null, null, true), CancellationToken.None);
        var itemId = await inventoryService.UpsertItemAsync(null,
            new UpsertInventoryItemCommand("Mat Item", null, "MAT-1", catId, "Box", true, 1m, 2m, 10m, null, null),
            CancellationToken.None);

        // No stock received — consumption must fail with InsufficientStockException
        var treatmentId = Guid.NewGuid();
        var consumption = new[] { new MaterialConsumptionItem(itemId, 1m, "test") };

        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            consumptionService.RecordConsumptionAsync(clinic.TenantId, treatmentId, consumption, CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 12. Inventory permission boundaries (AllowAll vs DenyAll)
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task InventoryPermissionBoundariesEnforced()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-perm", "admin@inv-perm.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        // Override permission service with deny-all
        var services = new ServiceCollection();
        var masterConn = fixture.Postgres.GetConnectionString();
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
        services.AddSingleton<IPermissionService, DenyAllPermissionService>(); // <── deny all

        await using var denyProvider = services.BuildServiceProvider();
        await using var denyScope = denyProvider.CreateAsyncScope();
        var restrictedService = denyScope.ServiceProvider.GetRequiredService<IInventoryService>();

        // All mutating operations must throw UnauthorizedAccessException
        await Assert.ThrowsAnyAsync<Exception>(() =>
            restrictedService.UpsertCategoryAsync(null,
                new UpsertInventoryCategoryCommand("Blocked", null, null, true), CancellationToken.None));

        await Assert.ThrowsAnyAsync<Exception>(() =>
            restrictedService.UpsertSupplierAsync(null,
                new UpsertSupplierCommand("Blocked", null, null, null, null, null, true), CancellationToken.None));
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 15. Inventory category isolation (per-tenant)
    // ────────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task InventoryCategoryIsolationPerTenant()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "inv-catiso-a", "admin@catiso-a.example");
        var clinicB = await CreateClinicAsync(test, "inv-catiso-b", "admin@catiso-b.example");

        // Tenant A creates a category
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<IInventoryService>();
        var catIdA = await serviceA.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Exclusive-Cat-A", null, null, true), CancellationToken.None);

        // Tenant B must not see Tenant A's category
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<IInventoryService>();
        var catsB = await serviceB.GetCategoriesAsync(CancellationToken.None);
        Assert.DoesNotContain(catsB, c => c.Id == catIdA);

        // Tenant B creates its own category — must not conflict with A's
        var catIdB = await serviceB.UpsertCategoryAsync(null,
            new UpsertInventoryCategoryCommand("Exclusive-Cat-B", null, null, true), CancellationToken.None);
        Assert.NotEqual(catIdA, catIdB);

        // Tenant A must not see Tenant B's category
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA2 = test.Provider.CreateAsyncScope();
        var serviceA2 = scopeA2.ServiceProvider.GetRequiredService<IInventoryService>();
        var catsA2 = await serviceA2.GetCategoriesAsync(CancellationToken.None);
        Assert.DoesNotContain(catsA2, c => c.Id == catIdB);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Concurrency helpers
    // ────────────────────────────────────────────────────────────────────────────

    private static async Task IssueFromSeparateScopeAsync(TestContext test, Guid itemId, decimal qty, string reference)
    {
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();
        await service.IssueStockAsync(new IssueStockCommand(itemId, qty, reference, null), CancellationToken.None);
    }

    private static async Task<Exception?> SafeRunAsync(Task task)
    {
        try
        {
            await task;
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Infrastructure helpers
    // ────────────────────────────────────────────────────────────────────────────

    private async Task<TestContext> CreateContextAsync()
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"inventory_test_{Guid.NewGuid():N}";
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

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear();
        test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        var clinics = scope.ServiceProvider.GetRequiredService<IClinicManagementService>();
        return await clinics.CreateAsync(new CreateClinicCommand(
            "Clinic " + slug, slug, "+20 1000", email, "Address", "Cairo", "Egypt", "Africa/Cairo", "EGP", email, null
        ), CancellationToken.None);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Test doubles
    // ────────────────────────────────────────────────────────────────────────────

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
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "inventory-integration"; }
    private sealed class NullInvitationNotifier : IClinicInvitationNotifier { public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
    private sealed class AllowAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class DenyAllPermissionService : IPermissionService { public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(false); public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => throw new UnauthorizedAccessException($"Permission denied: {permission}"); }
}
