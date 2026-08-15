using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Inventory;

public sealed class StockMovement : TenantOwnedEntity
{
    private StockMovement() { }

    public StockMovement(
        Guid tenantId,
        Guid itemId,
        StockMovementType movementType,
        decimal quantity,
        decimal? unitCost,
        decimal? totalCost,
        DateTimeOffset occurredAt,
        string reference,
        Guid? supplierId,
        Guid createdByUserId,
        string? notes
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (itemId == Guid.Empty) throw new ArgumentException("Item ID is required.", nameof(itemId));
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity must be positive.");
        if (unitCost.HasValue && unitCost.Value < 0) throw new ArgumentOutOfRangeException(nameof(unitCost), "Unit cost cannot be negative.");
        if (totalCost.HasValue && totalCost.Value < 0) throw new ArgumentOutOfRangeException(nameof(totalCost), "Total cost cannot be negative.");
        if (string.IsNullOrWhiteSpace(reference)) throw new ArgumentException("Reference is required.", nameof(reference));
        if (createdByUserId == Guid.Empty) throw new ArgumentException("CreatedBy User ID is required.", nameof(createdByUserId));

        TenantId = tenantId;
        ItemId = itemId;
        MovementType = movementType;
        Quantity = quantity;
        UnitCost = unitCost;
        TotalCost = totalCost ?? (unitCost.HasValue ? unitCost.Value * quantity : null);
        OccurredAt = occurredAt;
        Reference = reference.Trim();
        SupplierId = supplierId;
        CreatedByUserId = createdByUserId;
        Notes = notes?.Trim();
    }

    public Guid ItemId { get; private set; }
    public StockMovementType MovementType { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal? UnitCost { get; private set; }
    public decimal? TotalCost { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public string Reference { get; private set; } = string.Empty;
    public Guid? SupplierId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public string? Notes { get; private set; }
}
