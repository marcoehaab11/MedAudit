using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Patients;

internal sealed class PatientMedicalCommands(
    IPatientStore store,
    IPermissionService permissions,
    ICurrentTenant currentTenant,
    ICurrentUser currentUser,
    ISystemClock clock) : IPatientMedicalCommands
{
    public async Task<bool> UpdateMedicalNotesAsync(
        UpdateMedicalNotesCommand command,
        CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken);
        if (command.MedicalNotes?.Trim().Length > 4000)
            throw PatientValidation.Error("MedicalNotes", "Medical notes cannot exceed 4000 characters.");
        var patient = await ActivePatientAsync(command.PatientId, cancellationToken);
        if (patient is null) return false;
        patient.UpdateMedicalNotes(command.MedicalNotes, clock.UtcNow);
        AddAudit(PlatformAuditAction.PatientUpdated, nameof(Patient), patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<Guid?> AddAllergyAsync(
        Guid patientId, MedicalTextCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.MedicalText(command);
        var patient = await ActivePatientAsync(patientId, cancellationToken); if (patient is null) return null;
        var item = new PatientAllergy(patient.TenantId, patient.Id, command.Name, command.Notes, clock.UtcNow);
        store.AddAllergy(item); AddAudit(PlatformAuditAction.AllergyAdded, nameof(PatientAllergy), item.Id);
        await store.SaveChangesAsync(cancellationToken); return item.Id;
    }

    public async Task<bool> UpdateAllergyAsync(
        Guid patientId, Guid allergyId, MedicalTextCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.MedicalText(command);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindAllergyAsync(patientId, allergyId, cancellationToken); if (item is null) return false;
        item.Update(command.Name, command.Notes, clock.UtcNow);
        AddAudit(PlatformAuditAction.AllergyUpdated, nameof(PatientAllergy), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<bool> RemoveAllergyAsync(Guid patientId, Guid allergyId, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindAllergyAsync(patientId, allergyId, cancellationToken); if (item is null) return false;
        store.RemoveAllergy(item); AddAudit(PlatformAuditAction.AllergyRemoved, nameof(PatientAllergy), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<Guid?> AddConditionAsync(
        Guid patientId, MedicalTextCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.MedicalText(command);
        var patient = await ActivePatientAsync(patientId, cancellationToken); if (patient is null) return null;
        var item = new PatientMedicalCondition(patient.TenantId, patient.Id, command.Name, command.Notes, clock.UtcNow);
        store.AddCondition(item); AddAudit(PlatformAuditAction.MedicalConditionAdded, nameof(PatientMedicalCondition), item.Id);
        await store.SaveChangesAsync(cancellationToken); return item.Id;
    }

    public async Task<bool> UpdateConditionAsync(
        Guid patientId, Guid conditionId, MedicalTextCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.MedicalText(command);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindConditionAsync(patientId, conditionId, cancellationToken); if (item is null) return false;
        item.Update(command.Name, command.Notes, clock.UtcNow);
        AddAudit(PlatformAuditAction.MedicalConditionUpdated, nameof(PatientMedicalCondition), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<bool> RemoveConditionAsync(Guid patientId, Guid conditionId, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindConditionAsync(patientId, conditionId, cancellationToken); if (item is null) return false;
        store.RemoveCondition(item); AddAudit(PlatformAuditAction.MedicalConditionRemoved, nameof(PatientMedicalCondition), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<Guid?> AddMedicationAsync(
        Guid patientId, MedicationCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.Medication(command);
        var patient = await ActivePatientAsync(patientId, cancellationToken); if (patient is null) return null;
        var item = new PatientMedication(patient.TenantId, patient.Id, command.Name, command.Dosage, command.Notes, clock.UtcNow);
        store.AddMedication(item); AddAudit(PlatformAuditAction.MedicationAdded, nameof(PatientMedication), item.Id);
        await store.SaveChangesAsync(cancellationToken); return item.Id;
    }

    public async Task<bool> UpdateMedicationAsync(
        Guid patientId, Guid medicationId, MedicationCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); PatientValidation.Medication(command);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindMedicationAsync(patientId, medicationId, cancellationToken); if (item is null) return false;
        item.Update(command.Name, command.Dosage, command.Notes, clock.UtcNow);
        AddAudit(PlatformAuditAction.MedicationUpdated, nameof(PatientMedication), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<bool> RemoveMedicationAsync(Guid patientId, Guid medicationId, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindMedicationAsync(patientId, medicationId, cancellationToken); if (item is null) return false;
        store.RemoveMedication(item); AddAudit(PlatformAuditAction.MedicationRemoved, nameof(PatientMedication), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<Guid?> AddSurgeryAsync(
        Guid patientId, SurgeryCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); ValidateSurgery(command);
        var patient = await ActivePatientAsync(patientId, cancellationToken); if (patient is null) return null;
        var item = new PatientSurgery(patient.TenantId, patient.Id, command.Procedure, command.ProcedureDate, command.Notes, clock.UtcNow);
        store.AddSurgery(item); AddAudit(PlatformAuditAction.SurgeryAdded, nameof(PatientSurgery), item.Id);
        await store.SaveChangesAsync(cancellationToken); return item.Id;
    }

    public async Task<bool> UpdateSurgeryAsync(
        Guid patientId, Guid surgeryId, SurgeryCommand command, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken); ValidateSurgery(command);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindSurgeryAsync(patientId, surgeryId, cancellationToken); if (item is null) return false;
        item.Update(command.Procedure, command.ProcedureDate, command.Notes, clock.UtcNow);
        AddAudit(PlatformAuditAction.SurgeryUpdated, nameof(PatientSurgery), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    public async Task<bool> RemoveSurgeryAsync(Guid patientId, Guid surgeryId, CancellationToken cancellationToken)
    {
        await EnsureEditAsync(cancellationToken);
        if (await ActivePatientAsync(patientId, cancellationToken) is null) return false;
        var item = await store.FindSurgeryAsync(patientId, surgeryId, cancellationToken); if (item is null) return false;
        store.RemoveSurgery(item); AddAudit(PlatformAuditAction.SurgeryRemoved, nameof(PatientSurgery), item.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    private Task EnsureEditAsync(CancellationToken cancellationToken) =>
        permissions.EnsurePermissionAsync(Permissions.PatientsEditMedicalHistory, cancellationToken);

    private async Task<Patient?> ActivePatientAsync(Guid patientId, CancellationToken cancellationToken)
    {
        var patient = await store.FindPatientAsync(patientId, cancellationToken);
        if (patient?.Status == PatientStatus.Archived)
            throw PatientValidation.Error("Patient", "Archived patients cannot be modified.");
        return patient;
    }

    private void ValidateSurgery(SurgeryCommand command)
    {
        PatientValidation.Surgery(command);
        if (command.ProcedureDate > DateOnly.FromDateTime(clock.UtcNow.UtcDateTime))
            throw PatientValidation.Error("ProcedureDate", "Surgery date cannot be in the future.");
    }

    private void AddAudit(PlatformAuditAction action, string entityType, Guid entityId) =>
        store.AddAudit(new PlatformAuditLog(
            currentTenant.RequireTenantId(), currentUser.UserId, action,
            entityType, entityId, clock.UtcNow, null));
}
