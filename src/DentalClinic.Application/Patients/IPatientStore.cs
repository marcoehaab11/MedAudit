using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Patients;

public interface IPatientStore
{
    Task<IPatientTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    Task<string> ReservePatientNumberAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<PagedResult<PatientListItem>> SearchAsync(PatientSearchQuery query, CancellationToken cancellationToken);
    Task<PatientDetails?> GetDetailsAsync(
        Guid patientId, bool includeMedicalInformation, bool canEditMedicalInformation,
        CancellationToken cancellationToken);
    Task<Patient?> FindPatientAsync(Guid patientId, CancellationToken cancellationToken);
    Task<PatientAllergy?> FindAllergyAsync(Guid patientId, Guid allergyId, CancellationToken cancellationToken);
    Task<PatientMedicalCondition?> FindConditionAsync(Guid patientId, Guid conditionId, CancellationToken cancellationToken);
    Task<PatientMedication?> FindMedicationAsync(Guid patientId, Guid medicationId, CancellationToken cancellationToken);
    Task<PatientSurgery?> FindSurgeryAsync(Guid patientId, Guid surgeryId, CancellationToken cancellationToken);
    void AddPatient(Patient patient);
    void AddAllergy(PatientAllergy allergy);
    void AddCondition(PatientMedicalCondition condition);
    void AddMedication(PatientMedication medication);
    void AddSurgery(PatientSurgery surgery);
    void RemoveAllergy(PatientAllergy allergy);
    void RemoveCondition(PatientMedicalCondition condition);
    void RemoveMedication(PatientMedication medication);
    void RemoveSurgery(PatientSurgery surgery);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
