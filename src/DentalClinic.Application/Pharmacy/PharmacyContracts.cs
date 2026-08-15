using DentalClinic.Domain.Pharmacy;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Pharmacy;

public sealed record PharmacyDashboardSummaryDto(
    int WaitingForDispensingCount,
    int PartiallyDispensedCount,
    int FullyDispensedTodayCount,
    int DispensingCountToday,
    int LowStockMedicationCount,
    IReadOnlyCollection<PharmacyDispensingSummaryDto> RecentActivity
);

public sealed record PharmacyDispensingSummaryDto(
    Guid Id,
    string DispensingNumber,
    Guid PrescriptionId,
    string PrescriptionNumber,
    Guid PatientId,
    string PatientName,
    DispensingStatus Status,
    DateTimeOffset DispensedAt,
    Guid DispensedByUserId,
    string? DispensedByUserName,
    int ItemCount
);

public sealed record PharmacyDispensingDetailDto(
    Guid Id,
    string DispensingNumber,
    Guid PrescriptionId,
    string PrescriptionNumber,
    Guid PatientId,
    string PatientName,
    DispensingStatus Status,
    DateTimeOffset DispensedAt,
    Guid DispensedByUserId,
    string? DispensedByUserName,
    string? Notes,
    Guid Version,
    IReadOnlyCollection<PharmacyDispensingItemDetailDto> Items,
    PharmacyDispensingReversalDto? Reversal
);

public sealed record PharmacyDispensingItemDetailDto(
    Guid Id,
    Guid PrescriptionItemId,
    string MedicationName,
    Guid InventoryItemId,
    string InventoryItemName,
    string InventoryItemSku,
    decimal QuantityDispensed,
    decimal? UnitCost,
    decimal? TotalCost,
    Guid StockMovementId
);

public sealed record PharmacyDispensingReversalDto(
    Guid Id,
    Guid ReversedByUserId,
    string? ReversedByUserName,
    DateTimeOffset ReversedAt,
    string Reason,
    Guid StockMovementId
);

public sealed record PrescriptionReadyForDispensingDto(
    Guid PrescriptionId,
    string PrescriptionNumber,
    Guid PatientId,
    string PatientName,
    Guid DoctorProfileId,
    string DoctorName,
    DateTimeOffset IssuedAt,
    string Status,
    IReadOnlyCollection<PrescriptionItemDispensingStateDto> Items
);

public sealed record PrescriptionItemDispensingStateDto(
    Guid PrescriptionItemId,
    Guid? MedicationId,
    string MedicationName,
    string? GenericName,
    string? Strength,
    MedicationForm? Form,
    string Dose,
    string Frequency,
    string Duration,
    string Instructions,
    int? PrescribedQuantity,
    decimal TotalDispensedQuantity,
    decimal RemainingQuantity,
    Guid? MappedInventoryItemId,
    string? MappedInventoryItemName,
    decimal AvailableInventoryStock
);

public sealed record DispensePrescriptionItemCommand(
    Guid PrescriptionItemId,
    Guid InventoryItemId,
    decimal QuantityToDispense
);

public sealed record DispensePrescriptionCommand(
    Guid PrescriptionId,
    IReadOnlyCollection<DispensePrescriptionItemCommand> Items,
    string? Notes
);

public sealed record ReverseDispensingCommand(
    Guid DispensingId,
    string Reason
);

public sealed record UpdateMedicationInventoryMappingCommand(
    Guid? InventoryItemId,
    string? Barcode,
    string? Manufacturer,
    decimal? ReorderLevel
);

public sealed record MedicationCatalogPharmacyDto(
    Guid Id,
    string Name,
    string? GenericName,
    string? Strength,
    MedicationForm? Form,
    string? Notes,
    string? Barcode,
    string? Manufacturer,
    decimal? ReorderLevel,
    Guid? InventoryItemId,
    string? InventoryItemName,
    string? InventoryItemSku,
    decimal? AvailableStock,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record PatientPharmacyHistoryItemDto(
    Guid DispensingId,
    string DispensingNumber,
    Guid PrescriptionId,
    string PrescriptionNumber,
    string MedicationName,
    decimal QuantityPrescribed,
    decimal QuantityDispensed,
    decimal QuantityRemaining,
    DispensingStatus Status,
    DateTimeOffset DispensedAt
);

public sealed record PagedResult<T>(
    IReadOnlyCollection<T> Items,
    int TotalCount,
    int PageNumber,
    int PageSize
);
