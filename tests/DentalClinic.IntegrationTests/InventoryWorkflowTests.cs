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

    [Fact]
    public async Task StockMovementReceiptIssueAdjustCalculatesBalance()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-clinic-1", "admin@inv1.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        // Create Category
        var catId = await service.UpsertCategoryAsync(null, new UpsertInventoryCategoryCommand("Consumables", "مستهلكات", null, true), CancellationToken.None);

        // Create Supplier
        var supId = await service.UpsertSupplierAsync(null, new UpsertSupplierCommand("Medical Supplies Co", "John", "0100000000", "sales@med.com", null, null, true), CancellationToken.None);

        // Create Inventory Item
        var itemId = await service.UpsertItemAsync(null, new UpsertInventoryItemCommand(
            "Anesthetic Cartridges", "أمبولات مخدر", "ANESTH-2", catId, "Box", true, 5m, 10m, 200m, "Local anesthetic", supId
        ), CancellationToken.None);

        // Receive 50 boxes
        await service.ReceiveStockAsync(new ReceiveStockCommand(itemId, 50m, 200m, supId, "PO-5001", "Initial stock", false), CancellationToken.None);

        // Issue 15 boxes
        await service.IssueStockAsync(new IssueStockCommand(itemId, 15m, "USAGE-101", "Clinic usage"), CancellationToken.None);

        // Adjust down 5 boxes (damaged)
        await service.AdjustStockAsync(new AdjustStockCommand(itemId, StockMovementType.AdjustmentDecrease, 5m, "ADJ-001", "Damaged box"), CancellationToken.None);

        // Verify derived stock = 30
        var itemDto = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(itemDto);
        Assert.Equal(30m, itemDto.CurrentStock);
        Assert.Equal(6000m, itemDto.TotalValue);
        Assert.False(itemDto.IsLowStock);
        Assert.False(itemDto.IsOutOfStock);
    }

    [Fact]
    public async Task InsufficientStockThrowsConflict()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "inv-clinic-2", "admin@inv2.example");

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IInventoryService>();

        var catId = await service.UpsertCategoryAsync(null, new UpsertInventoryCategoryCommand("Surgical", "جراحي", null, true), CancellationToken.None);
        var itemId = await service.UpsertItemAsync(null, new UpsertInventoryItemCommand(
            "Surgical Gloves M", "قفازات جراحية M", "GLOVE-M", catId, "Box", true, 2m, 5m, 50m, null, null
        ), CancellationToken.None);

        // Receive 10 boxes
        await service.ReceiveStockAsync(new ReceiveStockCommand(itemId, 10m, 50m, null, "PO-10", null, false), CancellationToken.None);

        // Issue 7 boxes — should succeed (3 remaining)
        await service.IssueStockAsync(new IssueStockCommand(itemId, 7m, "USAGE-1", null), CancellationToken.None);

        // Attempting to issue 7 more when only 3 remain must throw InsufficientStockException
        await Assert.ThrowsAsync<InsufficientStockException>(() =>
            service.IssueStockAsync(new IssueStockCommand(itemId, 7m, "USAGE-2", null), CancellationToken.None)
        );

        // Stock must still be 3 — the failed issue must not have persisted
        var item = await service.GetItemByIdAsync(itemId, CancellationToken.None);
        Assert.NotNull(item);
        Assert.Equal(3m, item.CurrentStock);
    }

    [Fact]
    public async Task TenantIsolationCrossTenantItemsNotVisible()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "inv-clinic-a", "admin@inva.example");
        var clinicB = await CreateClinicAsync(test, "inv-clinic-b", "admin@invb.example");

        // Tenant A: create an item
        test.Tenant.Set(clinicA.TenantId);
        test.User.UserId = clinicA.AdminUserId;
        await using var scopeA = test.Provider.CreateAsyncScope();
        var serviceA = scopeA.ServiceProvider.GetRequiredService<IInventoryService>();

        var catIdA = await serviceA.UpsertCategoryAsync(null, new UpsertInventoryCategoryCommand("Cat A", null, null, true), CancellationToken.None);
        var itemIdA = await serviceA.UpsertItemAsync(null, new UpsertInventoryItemCommand(
            "Item A", null, "SKU-A", catIdA, "Unit", true, 1m, 2m, 10m, null, null
        ), CancellationToken.None);

        // Tenant B: must not see Tenant A's items
        test.Tenant.Set(clinicB.TenantId);
        test.User.UserId = clinicB.AdminUserId;
        await using var scopeB = test.Provider.CreateAsyncScope();
        var serviceB = scopeB.ServiceProvider.GetRequiredService<IInventoryService>();

        var itemsB = await serviceB.GetItemsAsync(null, null, null, CancellationToken.None);
        Assert.DoesNotContain(itemsB, i => i.Id == itemIdA);

        var itemAFromB = await serviceB.GetItemByIdAsync(itemIdA, CancellationToken.None);
        Assert.Null(itemAFromB);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

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
}
