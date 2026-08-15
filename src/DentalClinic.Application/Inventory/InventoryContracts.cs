using DentalClinic.Domain.Inventory;

namespace DentalClinic.Application.Inventory;

public sealed record InventoryCategoryDto(
    Guid Id,
    string Name,
    string? ArabicName,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record UpsertInventoryCategoryCommand(
    string Name,
    string? ArabicName,
    string? Description,
    bool IsActive
);

public sealed record SupplierDto(
    Guid Id,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record UpsertSupplierCommand(
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes,
    bool IsActive
);

public sealed record InventoryItemDto(
    Guid Id,
    string Name,
    string? ArabicName,
    string Sku,
    Guid CategoryId,
    string CategoryName,
    string UnitOfMeasure,
    bool IsActive,
    decimal MinimumStockLevel,
    decimal ReorderLevel,
    decimal CurrentCost,
    decimal CurrentStock,
    decimal TotalValue,
    bool IsLowStock,
    bool IsOutOfStock,
    string? Description,
    Guid? SupplierId,
    string? SupplierName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record UpsertInventoryItemCommand(
    string Name,
    string? ArabicName,
    string Sku,
    Guid CategoryId,
    string UnitOfMeasure,
    bool IsActive,
    decimal MinimumStockLevel,
    decimal ReorderLevel,
    decimal CurrentCost,
    string? Description,
    Guid? SupplierId
);

public sealed record StockMovementDto(
    Guid Id,
    Guid ItemId,
    string ItemName,
    string ItemSku,
    StockMovementType MovementType,
    decimal Quantity,
    decimal? UnitCost,
    decimal? TotalCost,
    DateTimeOffset OccurredAt,
    string Reference,
    Guid? SupplierId,
    string? SupplierName,
    Guid CreatedByUserId,
    string? Notes
);

public sealed record ReceiveStockCommand(
    Guid ItemId,
    decimal Quantity,
    decimal? UnitCost,
    Guid? SupplierId,
    string Reference,
    string? Notes,
    bool PostExpenseToFinance
);

public sealed record IssueStockCommand(
    Guid ItemId,
    decimal Quantity,
    string Reference,
    string? Notes
);

public sealed record AdjustStockCommand(
    Guid ItemId,
    StockMovementType MovementType,
    decimal Quantity,
    string ReasonReference,
    string? Notes
);

public sealed record InventoryDashboardSummaryDto(
    int TotalItems,
    int LowStockCount,
    int OutOfStockCount,
    decimal TotalStockValuation
);

public sealed record MaterialConsumptionItem(
    Guid ItemId,
    decimal Quantity,
    string? Notes
);
