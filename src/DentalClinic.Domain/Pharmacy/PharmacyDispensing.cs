using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Pharmacy;

public sealed class PharmacyDispensing : TenantOwnedEntity
{
    private readonly List<PharmacyDispensingItem> items = [];

    private PharmacyDispensing() { }

    public PharmacyDispensing(
        Guid tenantId,
        Guid prescriptionId,
        Guid patientId,
        string dispensingNumber,
        Guid dispensedByUserId,
        DispensingStatus status,
        string? notes,
        DateTimeOffset now
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (prescriptionId == Guid.Empty) throw new ArgumentException("Prescription ID is required.", nameof(prescriptionId));
        if (patientId == Guid.Empty) throw new ArgumentException("Patient ID is required.", nameof(patientId));
        if (string.IsNullOrWhiteSpace(dispensingNumber)) throw new ArgumentException("Dispensing number is required.", nameof(dispensingNumber));
        if (dispensedByUserId == Guid.Empty) throw new ArgumentException("Dispensed by user ID is required.", nameof(dispensedByUserId));
        if (!Enum.IsDefined(status)) throw new ArgumentOutOfRangeException(nameof(status));

        TenantId = tenantId;
        PrescriptionId = prescriptionId;
        PatientId = patientId;
        DispensingNumber = dispensingNumber.Trim();
        DispensedByUserId = dispensedByUserId;
        Status = status;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        DispensedAt = now;
        CreatedAt = now;
        UpdatedAt = now;
        Version = Guid.NewGuid();
    }

    public Guid PrescriptionId { get; private set; }
    public Guid PatientId { get; private set; }
    public string DispensingNumber { get; private set; } = string.Empty;
    public Guid DispensedByUserId { get; private set; }
    public DispensingStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset DispensedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid Version { get; private set; }

    public IReadOnlyCollection<PharmacyDispensingItem> Items => items;

    public PharmacyDispensingItem AddItem(
        Guid prescriptionItemId,
        Guid inventoryItemId,
        decimal quantityDispensed,
        decimal? unitCost,
        decimal? totalCost,
        Guid stockMovementId,
        DateTimeOffset now
    )
    {
        if (Status == DispensingStatus.Reversed)
        {
            throw new PharmacyDispensingException("Cannot add items to a reversed dispensing record.");
        }

        var item = new PharmacyDispensingItem(
            TenantId,
            Id,
            prescriptionItemId,
            inventoryItemId,
            quantityDispensed,
            unitCost,
            totalCost,
            stockMovementId,
            now
        );

        items.Add(item);
        UpdatedAt = now;
        Version = Guid.NewGuid();
        return item;
    }

    public void MarkFullyDispensed(DateTimeOffset now)
    {
        if (Status == DispensingStatus.Reversed)
        {
            throw new PharmacyDispensingException("Cannot mark a reversed dispensing record as fully dispensed.");
        }

        Status = DispensingStatus.FullyDispensed;
        UpdatedAt = now;
        Version = Guid.NewGuid();
    }

    public void MarkReversed(DateTimeOffset now)
    {
        if (Status == DispensingStatus.Reversed)
        {
            throw new PharmacyDispensingException("Dispensing record is already reversed.");
        }

        Status = DispensingStatus.Reversed;
        UpdatedAt = now;
        Version = Guid.NewGuid();
    }
}

public sealed class PharmacyDispensingNumberSequence : TenantOwnedEntity
{
    private PharmacyDispensingNumberSequence() { }
    public long LastValue { get; private set; }
}
