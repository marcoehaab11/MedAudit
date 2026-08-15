using DentalClinic.Application.Inventory;
using DentalClinic.Domain.Inventory;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class InventoryStore(ApplicationDbContext context) : IInventoryStore
{
    public async Task<InventoryCategory?> FindCategoryByIdAsync(Guid tenantId, Guid categoryId, CancellationToken token)
    {
        return await context.InventoryCategories.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == categoryId, token);
    }

    public async Task<IReadOnlyCollection<InventoryCategoryDto>> GetCategoriesAsync(Guid tenantId, CancellationToken token)
    {
        return await context.InventoryCategories.AsNoTracking().IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .OrderBy(c => c.Name)
            .Select(c => new InventoryCategoryDto(
                c.Id, c.Name, c.ArabicName, c.Description, c.IsActive, c.CreatedAt, c.UpdatedAt
            )).ToListAsync(token);
    }

    public async Task AddCategoryAsync(InventoryCategory category, CancellationToken token)
    {
        await context.InventoryCategories.AddAsync(category, token);
    }

    public async Task<Supplier?> FindSupplierByIdAsync(Guid tenantId, Guid supplierId, CancellationToken token)
    {
        return await context.Suppliers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == supplierId, token);
    }

    public async Task<IReadOnlyCollection<SupplierDto>> GetSuppliersAsync(Guid tenantId, CancellationToken token)
    {
        return await context.Suppliers.AsNoTracking().IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId)
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(
                s.Id, s.Name, s.ContactPerson, s.Phone, s.Email, s.Address, s.Notes, s.IsActive, s.CreatedAt, s.UpdatedAt
            )).ToListAsync(token);
    }

    public async Task AddSupplierAsync(Supplier supplier, CancellationToken token)
    {
        await context.Suppliers.AddAsync(supplier, token);
    }

    public async Task<InventoryItem?> FindItemByIdAsync(Guid tenantId, Guid itemId, CancellationToken token)
    {
        return await context.InventoryItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.TenantId == tenantId && i.Id == itemId, token);
    }

    public async Task<InventoryItem?> FindItemByIdForUpdateAsync(Guid tenantId, Guid itemId, CancellationToken token)
    {
        var items = await context.InventoryItems
            .FromSqlInterpolated($@"
                SELECT * FROM inventory_items
                WHERE ""Id"" = {itemId} AND ""TenantId"" = {tenantId}
                FOR UPDATE")
            .ToListAsync(token);

        return items.FirstOrDefault();
    }

    public async Task<InventoryItem?> FindItemBySkuAsync(Guid tenantId, string sku, CancellationToken token)
    {
        var normalized = sku.Trim().ToUpperInvariant();
        return await context.InventoryItems.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.TenantId == tenantId && i.Sku == normalized, token);
    }

    public async Task<decimal> GetCurrentStockForUpdateAsync(Guid tenantId, Guid itemId, CancellationToken token)
    {
        var movements = await context.StockMovements.AsNoTracking().IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId && m.ItemId == itemId)
            .Select(m => new { m.MovementType, m.Quantity })
            .ToListAsync(token);

        return CalculateStockSum(movements.Select(m => ((int)m.MovementType, m.Quantity)));
    }

    public async Task<decimal> GetCurrentStockAsync(Guid tenantId, Guid itemId, CancellationToken token)
    {
        return await GetCurrentStockForUpdateAsync(tenantId, itemId, token);
    }

    public async Task<IReadOnlyCollection<InventoryItemDto>> GetItemsAsync(
        Guid tenantId, string? search, Guid? categoryId, bool? lowStockOnly, CancellationToken token)
    {
        var categories = await context.InventoryCategories.AsNoTracking().IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId)
            .ToDictionaryAsync(c => c.Id, c => c.Name, token);

        var suppliers = await context.Suppliers.AsNoTracking().IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId)
            .ToDictionaryAsync(s => s.Id, s => s.Name, token);

        var itemQuery = context.InventoryItems.AsNoTracking().IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            itemQuery = itemQuery.Where(i =>
                EF.Functions.ILike(i.Name, pattern) ||
                (i.ArabicName != null && EF.Functions.ILike(i.ArabicName, pattern)) ||
                EF.Functions.ILike(i.Sku, pattern));
        }

        if (categoryId.HasValue)
        {
            itemQuery = itemQuery.Where(i => i.CategoryId == categoryId.Value);
        }

        var items = await itemQuery.OrderBy(i => i.Name).ToListAsync(token);

        var movements = await context.StockMovements.AsNoTracking().IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId)
            .Select(m => new { m.ItemId, m.MovementType, m.Quantity })
            .ToListAsync(token);

        var stockByItem = movements.GroupBy(m => m.ItemId)
            .ToDictionary(
                g => g.Key,
                g => CalculateStockSum(g.Select(m => ((int)m.MovementType, m.Quantity)))
            );

        var result = new List<InventoryItemDto>();
        foreach (var item in items)
        {
            var currentStock = stockByItem.TryGetValue(item.Id, out var stock) ? stock : 0m;
            var isLowStock = currentStock <= item.MinimumStockLevel;
            var isOutOfStock = currentStock <= 0m;

            if (lowStockOnly == true && !isLowStock)
            {
                continue;
            }

            var categoryName = categories.TryGetValue(item.CategoryId, out var cn) ? cn : "Uncategorized";
            var supplierName = item.SupplierId.HasValue && suppliers.TryGetValue(item.SupplierId.Value, out var sn) ? sn : null;
            var totalValue = currentStock * item.CurrentCost;

            result.Add(new InventoryItemDto(
                item.Id, item.Name, item.ArabicName, item.Sku, item.CategoryId, categoryName,
                item.UnitOfMeasure, item.IsActive, item.MinimumStockLevel, item.ReorderLevel,
                item.CurrentCost, currentStock, totalValue, isLowStock, isOutOfStock,
                item.Description, item.SupplierId, supplierName, item.CreatedAt, item.UpdatedAt
            ));
        }

        return result;
    }

    public async Task AddItemAsync(InventoryItem item, CancellationToken token)
    {
        await context.InventoryItems.AddAsync(item, token);
    }

    public async Task<IReadOnlyCollection<StockMovementDto>> GetMovementsAsync(Guid tenantId, Guid? itemId, int take, CancellationToken token)
    {
        var itemMap = await context.InventoryItems.AsNoTracking().IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId)
            .ToDictionaryAsync(i => i.Id, i => new { i.Name, i.Sku }, token);

        var supplierMap = await context.Suppliers.AsNoTracking().IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId)
            .ToDictionaryAsync(s => s.Id, s => s.Name, token);

        var query = context.StockMovements.AsNoTracking().IgnoreQueryFilters()
            .Where(m => m.TenantId == tenantId);

        if (itemId.HasValue)
        {
            query = query.Where(m => m.ItemId == itemId.Value);
        }

        var movements = await query.OrderByDescending(m => m.OccurredAt)
            .Take(take)
            .ToListAsync(token);

        return movements.Select(m =>
        {
            var itemName = itemMap.TryGetValue(m.ItemId, out var itemInfo) ? itemInfo.Name : "Unknown Item";
            var itemSku = itemInfo?.Sku ?? string.Empty;
            var supplierName = m.SupplierId.HasValue && supplierMap.TryGetValue(m.SupplierId.Value, out var sn) ? sn : null;

            return new StockMovementDto(
                m.Id, m.ItemId, itemName, itemSku, m.MovementType, m.Quantity, m.UnitCost,
                m.TotalCost, m.OccurredAt, m.Reference, m.SupplierId, supplierName, m.CreatedByUserId, m.Notes
            );
        }).ToList();
    }

    public async Task AddStockMovementAsync(StockMovement movement, CancellationToken token)
    {
        await context.StockMovements.AddAsync(movement, token);
    }

    public async Task<InventoryDashboardSummaryDto> GetDashboardSummaryAsync(Guid tenantId, CancellationToken token)
    {
        var items = await GetItemsAsync(tenantId, null, null, null, token);
        var totalItems = items.Count;
        var lowStockCount = items.Count(i => i.IsLowStock);
        var outOfStockCount = items.Count(i => i.IsOutOfStock);
        var totalValuation = items.Sum(i => i.TotalValue);

        return new InventoryDashboardSummaryDto(totalItems, lowStockCount, outOfStockCount, totalValuation);
    }

    public async Task CommitAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }

    private static decimal CalculateStockSum(IEnumerable<(int MovementType, decimal Quantity)> movements)
    {
        decimal total = 0m;
        foreach (var (movementType, qty) in movements)
        {
            switch ((StockMovementType)movementType)
            {
                case StockMovementType.OpeningBalance:
                case StockMovementType.Receipt:
                case StockMovementType.AdjustmentIncrease:
                case StockMovementType.Return:
                    total += qty;
                    break;
                case StockMovementType.Issue:
                case StockMovementType.AdjustmentDecrease:
                    total -= qty;
                    break;
            }
        }
        return total;
    }
}
