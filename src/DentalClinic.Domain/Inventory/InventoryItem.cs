using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Inventory;

public sealed class InventoryItem : TenantOwnedEntity
{
    private InventoryItem() { }

    public InventoryItem(
        Guid tenantId,
        string name,
        string? arabicName,
        string sku,
        Guid categoryId,
        string unitOfMeasure,
        bool isActive,
        decimal minimumStockLevel,
        decimal reorderLevel,
        decimal currentCost,
        string? description,
        Guid? supplierId,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Item name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(sku)) throw new ArgumentException("SKU is required.", nameof(sku));
        if (categoryId == Guid.Empty) throw new ArgumentException("Category ID is required.", nameof(categoryId));
        if (string.IsNullOrWhiteSpace(unitOfMeasure)) throw new ArgumentException("Unit of measure is required.", nameof(unitOfMeasure));
        if (minimumStockLevel < 0) throw new ArgumentOutOfRangeException(nameof(minimumStockLevel), "Minimum stock level cannot be negative.");
        if (reorderLevel < 0) throw new ArgumentOutOfRangeException(nameof(reorderLevel), "Reorder level cannot be negative.");
        if (currentCost < 0) throw new ArgumentOutOfRangeException(nameof(currentCost), "Current cost cannot be negative.");

        TenantId = tenantId;
        Name = name.Trim();
        ArabicName = arabicName?.Trim();
        Sku = sku.Trim().ToUpperInvariant();
        CategoryId = categoryId;
        UnitOfMeasure = unitOfMeasure.Trim();
        IsActive = isActive;
        MinimumStockLevel = minimumStockLevel;
        ReorderLevel = reorderLevel;
        CurrentCost = currentCost;
        Description = description?.Trim();
        SupplierId = supplierId;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string? ArabicName { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public string UnitOfMeasure { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public decimal MinimumStockLevel { get; private set; }
    public decimal ReorderLevel { get; private set; }
    public decimal CurrentCost { get; private set; }
    public string? Description { get; private set; }
    public Guid? SupplierId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(
        string name,
        string? arabicName,
        string sku,
        Guid categoryId,
        string unitOfMeasure,
        bool isActive,
        decimal minimumStockLevel,
        decimal reorderLevel,
        decimal currentCost,
        string? description,
        Guid? supplierId,
        DateTimeOffset now
    )
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Item name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(sku)) throw new ArgumentException("SKU is required.", nameof(sku));
        if (categoryId == Guid.Empty) throw new ArgumentException("Category ID is required.", nameof(categoryId));
        if (string.IsNullOrWhiteSpace(unitOfMeasure)) throw new ArgumentException("Unit of measure is required.", nameof(unitOfMeasure));
        if (minimumStockLevel < 0) throw new ArgumentOutOfRangeException(nameof(minimumStockLevel), "Minimum stock level cannot be negative.");
        if (reorderLevel < 0) throw new ArgumentOutOfRangeException(nameof(reorderLevel), "Reorder level cannot be negative.");
        if (currentCost < 0) throw new ArgumentOutOfRangeException(nameof(currentCost), "Current cost cannot be negative.");

        Name = name.Trim();
        ArabicName = arabicName?.Trim();
        Sku = sku.Trim().ToUpperInvariant();
        CategoryId = categoryId;
        UnitOfMeasure = unitOfMeasure.Trim();
        IsActive = isActive;
        MinimumStockLevel = minimumStockLevel;
        ReorderLevel = reorderLevel;
        CurrentCost = currentCost;
        Description = description?.Trim();
        SupplierId = supplierId;
        UpdatedAt = now;
    }

    public void UpdateCost(decimal newCost, DateTimeOffset now)
    {
        if (newCost < 0) throw new ArgumentOutOfRangeException(nameof(newCost), "Cost cannot be negative.");
        CurrentCost = newCost;
        UpdatedAt = now;
    }
}
