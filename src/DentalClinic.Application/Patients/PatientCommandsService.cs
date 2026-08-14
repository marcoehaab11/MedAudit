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
        var tenantId = currentTenant.RequireTenantId();
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var patientNumber = await store.ReservePatientNumberAsync(tenantId, cancellationToken);
        var patient = NewPatient(tenantId, patientNumber, command.Profile, clock.UtcNow);
        store.AddPatient(patient);
        AddAudit(PlatformAuditAction.PatientCreated, patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return patient.Id;
    }

    public async Task<bool> UpdateAsync(UpdatePatientCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsEdit, cancellationToken);
        PatientValidation.Profile(command.Profile, clock.UtcNow);
        var patient = await store.FindPatientAsync(command.PatientId, cancellationToken);
        if (patient is null) return false;
        EnsureActive(patient);
        var p = command.Profile;
        patient.Update(p.FirstName, p.MiddleName, p.LastName, p.Gender, p.DateOfBirth, p.Phone,
            p.AlternatePhone, p.Email, p.Address, p.City, p.Country, p.EmergencyContactName,
            p.EmergencyContactPhone, p.Nationality, p.Occupation, p.MaritalStatus, p.Notes,
            patient.MedicalNotes, clock.UtcNow);
        AddAudit(PlatformAuditAction.PatientUpdated, patient.Id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

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
