using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Pharmacy;

public sealed class PharmacyDispensingItem : TenantOwnedEntity
{
    private PharmacyDispensingItem() { }

    internal PharmacyDispensingItem(
        Guid tenantId,
        Guid dispensingId,
        Guid prescriptionItemId,
        Guid inventoryItemId,
        decimal quantityDispensed,
        decimal? unitCost,
        decimal? totalCost,
        Guid stockMovementId,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (dispensingId == Guid.Empty) throw new ArgumentException("Dispensing ID is required.", nameof(dispensingId));
        if (prescriptionItemId == Guid.Empty) throw new ArgumentException("Prescription item ID is required.", nameof(prescriptionItemId));
        if (inventoryItemId == Guid.Empty) throw new ArgumentException("Inventory item ID is required.", nameof(inventoryItemId));
        if (quantityDispensed <= 0) throw new ArgumentOutOfRangeException(nameof(quantityDispensed), "Quantity dispensed must be greater than zero.");
        if (unitCost is < 0) throw new ArgumentOutOfRangeException(nameof(unitCost), "Unit cost cannot be negative.");
        if (totalCost is < 0) throw new ArgumentOutOfRangeException(nameof(totalCost), "Total cost cannot be negative.");
        if (stockMovementId == Guid.Empty) throw new ArgumentException("Stock movement ID is required.", nameof(stockMovementId));

        TenantId = tenantId;
        DispensingId = dispensingId;
        PrescriptionItemId = prescriptionItemId;
        InventoryItemId = inventoryItemId;
        QuantityDispensed = quantityDispensed;
        UnitCost = unitCost;
        TotalCost = totalCost;
        StockMovementId = stockMovementId;
        CreatedAt = createdAt;
    }

    public Guid DispensingId { get; private set; }
    public Guid PrescriptionItemId { get; private set; }
    public Guid InventoryItemId { get; private set; }
    public decimal QuantityDispensed { get; private set; }
    public decimal? UnitCost { get; private set; }
    public decimal? TotalCost { get; private set; }
    public Guid StockMovementId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}
