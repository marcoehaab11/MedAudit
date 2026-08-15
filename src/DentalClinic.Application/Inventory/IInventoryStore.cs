using DentalClinic.Domain.Inventory;

namespace DentalClinic.Application.Inventory;

public interface IInventoryStore
{
    Task<InventoryCategory?> FindCategoryByIdAsync(Guid tenantId, Guid categoryId, CancellationToken token);
    Task<IReadOnlyCollection<InventoryCategoryDto>> GetCategoriesAsync(Guid tenantId, CancellationToken token);
    Task AddCategoryAsync(InventoryCategory category, CancellationToken token);

    Task<Supplier?> FindSupplierByIdAsync(Guid tenantId, Guid supplierId, CancellationToken token);
    Task<IReadOnlyCollection<SupplierDto>> GetSuppliersAsync(Guid tenantId, CancellationToken token);
    Task AddSupplierAsync(Supplier supplier, CancellationToken token);

    Task<InventoryItem?> FindItemByIdAsync(Guid tenantId, Guid itemId, CancellationToken token);
    Task<InventoryItem?> FindItemByIdForUpdateAsync(Guid tenantId, Guid itemId, CancellationToken token);
    Task<InventoryItem?> FindItemBySkuAsync(Guid tenantId, string sku, CancellationToken token);
    Task<IReadOnlyCollection<InventoryItemDto>> GetItemsAsync(Guid tenantId, string? search, Guid? categoryId, bool? lowStockOnly, CancellationToken token);
    Task AddItemAsync(InventoryItem item, CancellationToken token);

    Task<decimal> GetCurrentStockForUpdateAsync(Guid tenantId, Guid itemId, CancellationToken token);
    Task<decimal> GetCurrentStockAsync(Guid tenantId, Guid itemId, CancellationToken token);
    Task<IReadOnlyCollection<StockMovementDto>> GetMovementsAsync(Guid tenantId, Guid? itemId, int take, CancellationToken token);
    Task AddStockMovementAsync(StockMovement movement, CancellationToken token);

    Task<InventoryDashboardSummaryDto> GetDashboardSummaryAsync(Guid tenantId, CancellationToken token);
    Task CommitAsync(CancellationToken token);
}

public interface IInventoryService
{
    Task<IReadOnlyCollection<InventoryCategoryDto>> GetCategoriesAsync(CancellationToken token);
    Task<Guid> UpsertCategoryAsync(Guid? id, UpsertInventoryCategoryCommand command, CancellationToken token);

    Task<IReadOnlyCollection<SupplierDto>> GetSuppliersAsync(CancellationToken token);
    Task<Guid> UpsertSupplierAsync(Guid? id, UpsertSupplierCommand command, CancellationToken token);

    Task<IReadOnlyCollection<InventoryItemDto>> GetItemsAsync(string? search, Guid? categoryId, bool? lowStockOnly, CancellationToken token);
    Task<InventoryItemDto?> GetItemByIdAsync(Guid id, CancellationToken token);
    Task<Guid> UpsertItemAsync(Guid? id, UpsertInventoryItemCommand command, CancellationToken token);

    Task<Guid> ReceiveStockAsync(ReceiveStockCommand command, CancellationToken token);
    Task<Guid> IssueStockAsync(IssueStockCommand command, CancellationToken token);
    Task<Guid> AdjustStockAsync(AdjustStockCommand command, CancellationToken token);

    Task<IReadOnlyCollection<StockMovementDto>> GetMovementsAsync(Guid? itemId, int take, CancellationToken token);
    Task<InventoryDashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken token);
}

public interface IMaterialConsumptionService
{
    Task RecordConsumptionAsync(Guid tenantId, Guid treatmentId, IEnumerable<MaterialConsumptionItem> items, CancellationToken token);
}
