namespace DentalClinic.Application.Patients;

public interface IPatientMedicalCommands
{
    Task<bool> UpdateMedicalNotesAsync(UpdateMedicalNotesCommand command, CancellationToken cancellationToken);
    Task<Guid?> AddAllergyAsync(Guid patientId, MedicalTextCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateAllergyAsync(Guid patientId, Guid allergyId, MedicalTextCommand command, CancellationToken cancellationToken);
    Task<bool> RemoveAllergyAsync(Guid patientId, Guid allergyId, CancellationToken cancellationToken);
    Task<Guid?> AddConditionAsync(Guid patientId, MedicalTextCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateConditionAsync(Guid patientId, Guid conditionId, MedicalTextCommand command, CancellationToken cancellationToken);
    Task<bool> RemoveConditionAsync(Guid patientId, Guid conditionId, CancellationToken cancellationToken);
    Task<Guid?> AddMedicationAsync(Guid patientId, MedicationCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateMedicationAsync(Guid patientId, Guid medicationId, MedicationCommand command, CancellationToken cancellationToken);
    Task<bool> RemoveMedicationAsync(Guid patientId, Guid medicationId, CancellationToken cancellationToken);
    Task<Guid?> AddSurgeryAsync(Guid patientId, SurgeryCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateSurgeryAsync(Guid patientId, Guid surgeryId, SurgeryCommand command, CancellationToken cancellationToken);
    Task<bool> RemoveSurgeryAsync(Guid patientId, Guid surgeryId, CancellationToken cancellationToken);
}
