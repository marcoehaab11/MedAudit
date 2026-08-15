using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Pharmacy;

public sealed class PharmacyDispensingReversal : TenantOwnedEntity
{
    private PharmacyDispensingReversal() { }

    public PharmacyDispensingReversal(
        Guid tenantId,
        Guid dispensingId,
        Guid reversedByUserId,
        DateTimeOffset reversedAt,
        string reason,
        Guid stockMovementId
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (dispensingId == Guid.Empty) throw new ArgumentException("Dispensing ID is required.", nameof(dispensingId));
        if (reversedByUserId == Guid.Empty) throw new ArgumentException("Reversed by user ID is required.", nameof(reversedByUserId));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Reason is required.", nameof(reason));
        if (stockMovementId == Guid.Empty) throw new ArgumentException("Stock movement ID is required.", nameof(stockMovementId));

        TenantId = tenantId;
        DispensingId = dispensingId;
        ReversedByUserId = reversedByUserId;
        ReversedAt = reversedAt;
        Reason = reason.Trim();
        StockMovementId = stockMovementId;
        CreatedAt = reversedAt;
    }

    public Guid DispensingId { get; private set; }
    public Guid ReversedByUserId { get; private set; }
    public DateTimeOffset ReversedAt { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public Guid StockMovementId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}
