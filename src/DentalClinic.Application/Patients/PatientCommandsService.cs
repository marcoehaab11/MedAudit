using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Patients;

internal sealed class PatientCommandsService(
    IPatientStore store,
    IPermissionService permissions,
    ICurrentTenant currentTenant,
    ICurrentUser currentUser,
    ISystemClock clock) : IPatientCommands
{
    public async Task<Guid> CreateAsync(CreatePatientCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsCreate, cancellationToken);
        PatientValidation.Profile(command.Profile, clock.UtcNow);
        var allergies = InitialNames(command.Allergies).ToArray();
        var conditions = InitialNames(command.MedicalConditions).ToArray();
        var medications = InitialNames(command.Medications).ToArray();
        var tenantId = currentTenant.RequireTenantId();
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var patientNumber = await store.ReservePatientNumberAsync(tenantId, cancellationToken);
        var patient = NewPatient(tenantId, patientNumber, command.Profile, clock.UtcNow);
        store.AddPatient(patient);
        foreach (var name in allergies)
        {
            var item = new PatientAllergy(tenantId, patient.Id, name, null, clock.UtcNow);
            store.AddAllergy(item);
            store.AddAudit(new PlatformAuditLog(tenantId, currentUser.UserId, PlatformAuditAction.AllergyAdded, nameof(PatientAllergy), item.Id, clock.UtcNow, null));
        }
        foreach (var name in conditions)
        {
            var item = new PatientMedicalCondition(tenantId, patient.Id, name, null, clock.UtcNow);
            store.AddCondition(item);
            store.AddAudit(new PlatformAuditLog(tenantId, currentUser.UserId, PlatformAuditAction.MedicalConditionAdded, nameof(PatientMedicalCondition), item.Id, clock.UtcNow, null));
        }
        foreach (var name in medications)
        {
            var item = new PatientMedication(tenantId, patient.Id, name, null, null, clock.UtcNow);
            store.AddMedication(item);
            store.AddAudit(new PlatformAuditLog(tenantId, currentUser.UserId, PlatformAuditAction.MedicationAdded, nameof(PatientMedication), item.Id, clock.UtcNow, null));
        }
        AddAudit(PlatformAuditAction.PatientCreated, patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return patient.Id;
    }

    public async Task<bool> UpdateAsync(UpdatePatientCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsEdit, cancellationToken);
        PatientValidation.Profile(command.Profile, clock.UtcNow);
        var hasMedicalChanges = command.Allergies is not null || command.MedicalConditions is not null || command.Medications is not null;
        if (hasMedicalChanges)
        {
            await permissions.EnsurePermissionAsync(Permissions.PatientsViewMedicalHistory, cancellationToken);
            await permissions.EnsurePermissionAsync(Permissions.PatientsEditMedicalHistory, cancellationToken);
        }
        var allergies = command.Allergies is null ? null : InitialNames(command.Allergies).ToArray();
        var conditions = command.MedicalConditions is null ? null : InitialNames(command.MedicalConditions).ToArray();
        var medications = command.Medications is null ? null : InitialNames(command.Medications).ToArray();
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var patient = await store.FindPatientAsync(command.PatientId, cancellationToken);
        if (patient is null) return false;
        EnsureActive(patient);
        if (hasMedicalChanges)
        {
            var previous = await store.GetDetailsAsync(patient.Id, true, true, cancellationToken)
                ?? throw PatientValidation.Error("Patient", "Patient not found.");
            var tenantId = currentTenant.RequireTenantId();
            await SyncNamesAsync(allergies, previous.Allergies.Select(x => (x.Id, x.Name)),
                id => store.FindAllergyAsync(patient.Id, id, cancellationToken), store.RemoveAllergy,
                name => { var item = new PatientAllergy(tenantId, patient.Id, name, null, clock.UtcNow); store.AddAllergy(item); MedicalAudit(PlatformAuditAction.AllergyAdded, item.Id); }, PlatformAuditAction.AllergyRemoved);
            await SyncNamesAsync(conditions, previous.MedicalConditions.Select(x => (x.Id, x.Name)),
                id => store.FindConditionAsync(patient.Id, id, cancellationToken), store.RemoveCondition,
                name => { var item = new PatientMedicalCondition(tenantId, patient.Id, name, null, clock.UtcNow); store.AddCondition(item); MedicalAudit(PlatformAuditAction.MedicalConditionAdded, item.Id); }, PlatformAuditAction.MedicalConditionRemoved);
            await SyncNamesAsync(medications, previous.Medications.Select(x => (x.Id, x.Name)),
                id => store.FindMedicationAsync(patient.Id, id, cancellationToken), store.RemoveMedication,
                name => { var item = new PatientMedication(tenantId, patient.Id, name, null, null, clock.UtcNow); store.AddMedication(item); MedicalAudit(PlatformAuditAction.MedicationAdded, item.Id); }, PlatformAuditAction.MedicationRemoved);
        }
        var p = command.Profile;
        patient.Update(p.FirstName, p.MiddleName, p.LastName, p.Gender, p.DateOfBirth, p.Phone,
            p.AlternatePhone, p.Email, p.Address, p.City, p.Country, p.EmergencyContactName,
            p.EmergencyContactPhone, p.Nationality, p.Occupation, p.MaritalStatus, p.Notes,
            patient.MedicalNotes, clock.UtcNow);
        AddAudit(PlatformAuditAction.PatientUpdated, patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private async Task SyncNamesAsync<T>(string[]? requested, IEnumerable<(Guid Id, string Name)> previous,
        Func<Guid, Task<T?>> find, Action<T> remove, Action<string> add, PlatformAuditAction removedAction) where T : class
    {
        if (requested is null) return;
        var existing = previous.ToArray();
        foreach (var item in existing.Where(x => !requested.Contains(x.Name, StringComparer.OrdinalIgnoreCase)))
        {
            if (await find(item.Id) is { } entity) { remove(entity); MedicalAudit(removedAction, item.Id); }
        }
        foreach (var name in requested.Where(name => !existing.Any(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)))) add(name);
    }

    private void MedicalAudit(PlatformAuditAction action, Guid id) => store.AddAudit(new PlatformAuditLog(
        currentTenant.RequireTenantId(), currentUser.UserId, action, "PatientMedicalHistory", id, clock.UtcNow, null));

    public async Task<bool> ArchiveAsync(Guid patientId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsArchive, cancellationToken);
        var patient = await store.FindPatientAsync(patientId, cancellationToken);
        if (patient is null) return false;
        patient.Archive(clock.UtcNow);
        AddAudit(PlatformAuditAction.PatientArchived, patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static IEnumerable<string> InitialNames(IReadOnlyCollection<string>? names)
    {
        if (names is null) return [];
        if (names.Count > 100 || names.Any(name => string.IsNullOrWhiteSpace(name) || name.Trim().Length > 200))
            throw PatientValidation.Error("MedicalHistory", "Provide up to 100 non-empty names per medical history category.");
        return names.Select(name => name.Trim()).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private void AddAudit(PlatformAuditAction action, Guid entityId) =>
        store.AddAudit(new PlatformAuditLog(
            currentTenant.RequireTenantId(), currentUser.UserId, action,
            nameof(Patient), entityId, clock.UtcNow, null));

    private static void EnsureActive(Patient patient)
    {
        if (patient.Status == PatientStatus.Archived)
            throw PatientValidation.Error("Patient", "Archived patients cannot be modified.");
    }

    private static Patient NewPatient(
        Guid tenantId, string number, PatientProfileInput p, DateTimeOffset now) =>
        new(tenantId, number, p.FirstName, p.MiddleName, p.LastName, p.Gender, p.DateOfBirth,
            p.Phone, p.AlternatePhone, p.Email, p.Address, p.City, p.Country,
            p.EmergencyContactName, p.EmergencyContactPhone, p.Nationality, p.Occupation,
            p.MaritalStatus, p.Notes, null, now);
}
