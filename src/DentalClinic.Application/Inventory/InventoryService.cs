using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Inventory;

namespace DentalClinic.Application.Inventory;

internal sealed class InventoryService(
    IInventoryStore store,
    IPermissionService permissions,
    ICurrentTenant tenant,
    ICurrentUser user,
    ISystemClock clock,
    IExpenseService? expenseService = null
) : IInventoryService, IMaterialConsumptionService
{
    public async Task<IReadOnlyCollection<InventoryCategoryDto>> GetCategoriesAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetCategoriesAsync(tenantId, token);
    }

    public async Task<Guid> UpsertCategoryAsync(Guid? id, UpsertInventoryCategoryCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryManageCategories, token);
        var tenantId = tenant.RequireTenantId();

        if (id.HasValue)
        {
            var existing = await store.FindCategoryByIdAsync(tenantId, id.Value, token)
                ?? throw new InvalidOperationException("Inventory category not found.");
            existing.Update(command.Name, command.ArabicName, command.Description, command.IsActive, clock.UtcNow);
            await store.CommitAsync(token);
            return existing.Id;
        }

        var category = new InventoryCategory(
            tenantId, command.Name, command.ArabicName, command.Description, command.IsActive, clock.UtcNow
        );
        await store.AddCategoryAsync(category, token);
        await store.CommitAsync(token);
        return category.Id;
    }

    public async Task<IReadOnlyCollection<SupplierDto>> GetSuppliersAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetSuppliersAsync(tenantId, token);
    }

    public async Task<Guid> UpsertSupplierAsync(Guid? id, UpsertSupplierCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryManageSuppliers, token);
        var tenantId = tenant.RequireTenantId();

        if (id.HasValue)
        {
            var existing = await store.FindSupplierByIdAsync(tenantId, id.Value, token)
                ?? throw new InvalidOperationException("Supplier not found.");
            existing.Update(
                command.Name, command.ContactPerson, command.Phone, command.Email,
                command.Address, command.Notes, command.IsActive, clock.UtcNow
            );
            await store.CommitAsync(token);
            return existing.Id;
        }

        var supplier = new Supplier(
            tenantId, command.Name, command.ContactPerson, command.Phone, command.Email,
            command.Address, command.Notes, command.IsActive, clock.UtcNow
        );
        await store.AddSupplierAsync(supplier, token);
        await store.CommitAsync(token);
        return supplier.Id;
    }

    public async Task<IReadOnlyCollection<InventoryItemDto>> GetItemsAsync(string? search, Guid? categoryId, bool? lowStockOnly, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetItemsAsync(tenantId, search, categoryId, lowStockOnly, token);
    }

    public async Task<InventoryItemDto?> GetItemByIdAsync(Guid id, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        var items = await store.GetItemsAsync(tenantId, null, null, null, token);
        return items.FirstOrDefault(i => i.Id == id);
    }

    public async Task<Guid> UpsertItemAsync(Guid? id, UpsertInventoryItemCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryManageItems, token);
        var tenantId = tenant.RequireTenantId();

        // Verify category
        var cat = await store.FindCategoryByIdAsync(tenantId, command.CategoryId, token)
            ?? throw new InvalidOperationException("Category not found in current tenant.");

        // Verify supplier if provided
        if (command.SupplierId.HasValue)
        {
            _ = await store.FindSupplierByIdAsync(tenantId, command.SupplierId.Value, token)
                ?? throw new InvalidOperationException("Supplier not found in current tenant.");
        }

        // Verify SKU uniqueness
        var existingSku = await store.FindItemBySkuAsync(tenantId, command.Sku, token);
        if (existingSku != null && (!id.HasValue || existingSku.Id != id.Value))
        {
            throw new InvalidOperationException($"SKU '{command.Sku}' already exists in current tenant.");
        }

        if (id.HasValue)
        {
            var existing = await store.FindItemByIdAsync(tenantId, id.Value, token)
                ?? throw new InvalidOperationException("Inventory item not found.");
            existing.Update(
                command.Name, command.ArabicName, command.Sku, command.CategoryId, command.UnitOfMeasure,
                command.IsActive, command.MinimumStockLevel, command.ReorderLevel, command.CurrentCost,
                command.Description, command.SupplierId, clock.UtcNow
            );
            await store.CommitAsync(token);
            return existing.Id;
        }

        var item = new InventoryItem(
            tenantId, command.Name, command.ArabicName, command.Sku, command.CategoryId, command.UnitOfMeasure,
            command.IsActive, command.MinimumStockLevel, command.ReorderLevel, command.CurrentCost,
            command.Description, command.SupplierId, clock.UtcNow
        );
        await store.AddItemAsync(item, token);
        await store.CommitAsync(token);
        return item.Id;
    }

    public async Task<Guid> ReceiveStockAsync(ReceiveStockCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryReceive, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");

        var item = await store.FindItemByIdAsync(tenantId, command.ItemId, token)
            ?? throw new InvalidOperationException("Inventory item not found.");

        if (command.SupplierId.HasValue)
        {
            _ = await store.FindSupplierByIdAsync(tenantId, command.SupplierId.Value, token)
                ?? throw new InvalidOperationException("Supplier not found in current tenant.");
        }

        var unitCost = command.UnitCost ?? item.CurrentCost;
        if (command.UnitCost.HasValue && command.UnitCost.Value != item.CurrentCost)
        {
            item.UpdateCost(command.UnitCost.Value, clock.UtcNow);
        }

        var totalCost = unitCost * command.Quantity;

        var movement = new StockMovement(
            tenantId, item.Id, StockMovementType.Receipt, command.Quantity, unitCost, totalCost,
            clock.UtcNow, command.Reference, command.SupplierId, userId, command.Notes
        );

        await store.AddStockMovementAsync(movement, token);

        // Optional Finance integration: Record Expense if requested & expense service available
        if (command.PostExpenseToFinance && expenseService != null && totalCost > 0)
        {
            try
            {
                var categories = await store.GetCategoriesAsync(tenantId, token);
                var categoryId = categories.FirstOrDefault()?.Id ?? Guid.Empty;
                if (categoryId != Guid.Empty)
                {
                    var nowUtc = clock.UtcNow;
                    var date = DateOnly.FromDateTime(nowUtc.UtcDateTime);
                    var time = TimeOnly.FromDateTime(nowUtc.UtcDateTime);
                    await expenseService.CreateAsync(new ExpenseInput(
                        categoryId, totalCost, null, $"Inventory Receipt: {item.Name} (Ref: {command.Reference})",
                        null, command.Reference, date, time, command.Notes
                    ), token);
                }
            }
            catch
            {
                // Non-blocking: stock receipt succeeds even if financial expense posting fails or isn't configured
            }
        }

        await store.CommitAsync(token);
        return movement.Id;
    }

    public async Task<Guid> IssueStockAsync(IssueStockCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryIssue, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");

        // Lock item row FOR UPDATE and check current stock balance
        var item = await store.FindItemByIdForUpdateAsync(tenantId, command.ItemId, token)
            ?? throw new InvalidOperationException("Inventory item not found.");

        var currentStock = await store.GetCurrentStockForUpdateAsync(tenantId, item.Id, token);

        if (currentStock < command.Quantity)
        {
            throw new InsufficientStockException(
                $"Insufficient stock for item '{item.Name}'. Available: {currentStock}, Requested: {command.Quantity}."
            );
        }

        var movement = new StockMovement(
            tenantId, item.Id, StockMovementType.Issue, command.Quantity, item.CurrentCost,
            item.CurrentCost * command.Quantity, clock.UtcNow, command.Reference, null, userId, command.Notes
        );

        await store.AddStockMovementAsync(movement, token);
        await store.CommitAsync(token);
        return movement.Id;
    }

    public async Task<Guid> AdjustStockAsync(AdjustStockCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryAdjust, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");

        if (command.MovementType != StockMovementType.AdjustmentIncrease &&
            command.MovementType != StockMovementType.AdjustmentDecrease)
        {
            throw new ArgumentException("Adjustment movement type must be AdjustmentIncrease or AdjustmentDecrease.", nameof(command));
        }

        var item = await store.FindItemByIdForUpdateAsync(tenantId, command.ItemId, token)
            ?? throw new InvalidOperationException("Inventory item not found.");

        if (command.MovementType == StockMovementType.AdjustmentDecrease)
        {
            var currentStock = await store.GetCurrentStockForUpdateAsync(tenantId, item.Id, token);
            if (currentStock < command.Quantity)
            {
                throw new InsufficientStockException(
                    $"Cannot adjust stock below 0 for item '{item.Name}'. Available: {currentStock}, Requested decrease: {command.Quantity}."
                );
            }
        }

        var movement = new StockMovement(
            tenantId, item.Id, command.MovementType, command.Quantity, item.CurrentCost,
            item.CurrentCost * command.Quantity, clock.UtcNow, command.ReasonReference, null, userId, command.Notes
        );

        await store.AddStockMovementAsync(movement, token);
        await store.CommitAsync(token);
        return movement.Id;
    }

    public async Task<IReadOnlyCollection<StockMovementDto>> GetMovementsAsync(Guid? itemId, int take, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetMovementsAsync(tenantId, itemId, Math.Clamp(take, 1, 100), token);
    }

    public async Task<InventoryDashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.InventoryView, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetDashboardSummaryAsync(tenantId, token);
    }

    // Implementation of IMaterialConsumptionService for clinical material integration
    public async Task RecordConsumptionAsync(Guid tenantId, Guid treatmentId, IEnumerable<MaterialConsumptionItem> items, CancellationToken token)
    {
        var sysUserId = Guid.Empty;

        foreach (var ci in items)
        {
            var item = await store.FindItemByIdForUpdateAsync(tenantId, ci.ItemId, token);
            if (item == null) continue;

            var currentStock = await store.GetCurrentStockForUpdateAsync(tenantId, item.Id, token);
            if (currentStock < ci.Quantity) continue; // Skip or handle partial consumption safely

            var movement = new StockMovement(
                tenantId, item.Id, StockMovementType.Issue, ci.Quantity, item.CurrentCost,
                item.CurrentCost * ci.Quantity, clock.UtcNow, $"Treatment:{treatmentId:D}", null, sysUserId, ci.Notes ?? "Clinical material consumption"
            );

            await store.AddStockMovementAsync(movement, token);
        }

        await store.CommitAsync(token);
    }
}
