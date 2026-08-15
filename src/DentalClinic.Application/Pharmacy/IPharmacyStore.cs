using DentalClinic.Domain.Pharmacy;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Pharmacy;

public interface IPharmacyStore
{
    Task<PharmacyDispensing?> FindDispensingByIdAsync(Guid tenantId, Guid dispensingId, CancellationToken token);
    Task<PharmacyDispensing?> FindDispensingByIdForUpdateAsync(Guid tenantId, Guid dispensingId, CancellationToken token);
    Task<PharmacyDispensingReversal?> FindReversalByDispensingIdAsync(Guid tenantId, Guid dispensingId, CancellationToken token);
    
    Task<IReadOnlyCollection<PharmacyDispensingItem>> GetDispensingItemsForPrescriptionAsync(Guid tenantId, Guid prescriptionId, CancellationToken token);
    Task<IReadOnlyDictionary<Guid, decimal>> GetTotalDispensedQuantitiesByPrescriptionIdAsync(Guid tenantId, Guid prescriptionId, CancellationToken token);
    
    Task<PagedResult<PharmacyDispensingSummaryDto>> GetDispensingsAsync(
        Guid tenantId,
        Guid? patientId,
        string? prescriptionNumber,
        string? medicationSearch,
        Guid? pharmacistId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        DispensingStatus? status,
        int pageNumber,
        int pageSize,
        CancellationToken token
    );

    Task<PharmacyDispensingDetailDto?> GetDispensingDetailAsync(Guid tenantId, Guid dispensingId, CancellationToken token);
    
    Task<PagedResult<PrescriptionReadyForDispensingDto>> GetPrescriptionsReadyForDispensingAsync(
        Guid tenantId,
        string? search,
        int pageNumber,
        int pageSize,
        CancellationToken token
    );

    Task<PrescriptionReadyForDispensingDto?> GetPrescriptionDispensingDetailAsync(Guid tenantId, Guid prescriptionId, CancellationToken token);

    Task<IReadOnlyCollection<MedicationCatalogPharmacyDto>> GetMedicationCatalogAsync(Guid tenantId, string? search, bool? activeOnly, CancellationToken token);

    Task<IReadOnlyCollection<PatientPharmacyHistoryItemDto>> GetPatientPharmacyHistoryAsync(Guid tenantId, Guid patientId, CancellationToken token);

    Task<PharmacyDashboardSummaryDto> GetDashboardSummaryAsync(Guid tenantId, CancellationToken token);

    Task AddDispensingAsync(PharmacyDispensing dispensing, CancellationToken token);
    Task AddReversalAsync(PharmacyDispensingReversal reversal, CancellationToken token);

    Task<long> GetNextDispensingSequenceValueAsync(Guid tenantId, CancellationToken token);

    Task CommitAsync(CancellationToken token);
}

public interface IPharmacyService
{
    Task<PharmacyDashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken token);
    
    Task<PagedResult<PharmacyDispensingSummaryDto>> GetDispensingsAsync(
        Guid? patientId,
        string? prescriptionNumber,
        string? medicationSearch,
        Guid? pharmacistId,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        DispensingStatus? status,
        int pageNumber,
        int pageSize,
        CancellationToken token
    );

    Task<PharmacyDispensingDetailDto?> GetDispensingByIdAsync(Guid id, CancellationToken token);

    Task<PagedResult<PrescriptionReadyForDispensingDto>> GetPrescriptionsReadyForDispensingAsync(
        string? search,
        int pageNumber,
        int pageSize,
        CancellationToken token
    );

    Task<PrescriptionReadyForDispensingDto?> GetPrescriptionDispensingDetailAsync(Guid prescriptionId, CancellationToken token);

    Task<PharmacyDispensingDetailDto> DispensePrescriptionAsync(DispensePrescriptionCommand command, CancellationToken token);

    Task<PharmacyDispensingDetailDto> ReverseDispensingAsync(ReverseDispensingCommand command, CancellationToken token);

    Task<IReadOnlyCollection<MedicationCatalogPharmacyDto>> GetMedicationCatalogAsync(string? search, bool? activeOnly, CancellationToken token);

    Task UpdateMedicationInventoryMappingAsync(Guid medicationId, UpdateMedicationInventoryMappingCommand command, CancellationToken token);

    Task<IReadOnlyCollection<PatientPharmacyHistoryItemDto>> GetPatientPharmacyHistoryAsync(Guid patientId, CancellationToken token);
}
