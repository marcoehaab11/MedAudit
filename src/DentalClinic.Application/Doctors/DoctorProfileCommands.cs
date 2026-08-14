using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Doctors;

internal sealed class DoctorProfileCommands(IDoctorProfileStore store, IPermissionService permissions,
    ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock) : IDoctorProfileCommands
{
    public async Task<Guid> CreateAsync(CreateDoctorProfileCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsCreate, cancellationToken);
        DoctorValidation.Profile(command.Profile);
        if (!await store.IsDoctorUserAsync(command.ClinicUserId, cancellationToken))
            throw DoctorValidation.Error(nameof(command.ClinicUserId), "The selected clinic user must have the Doctor role in this tenant.");
        if (await store.ProfileExistsForUserAsync(command.ClinicUserId, cancellationToken))
            throw DoctorValidation.Error(nameof(command.ClinicUserId), "A doctor profile already exists for this clinic user.");
        if (await store.LicenseExistsAsync(command.Profile.LicenseNumber.Trim().ToUpperInvariant(), null, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Profile.LicenseNumber), "License number is already in use.");
        var input = command.Profile;
        var profile = new DoctorProfile(currentTenant.RequireTenantId(), command.ClinicUserId,
            input.Specialization, input.LicenseNumber, input.Bio, input.ConsultationDurationMinutes, clock.UtcNow);
        store.Add(profile); Audit(PlatformAuditAction.DoctorProfileCreated, profile.Id);
        await store.SaveChangesAsync(cancellationToken);
        return profile.Id;
    }

    public async Task<bool> UpdateAsync(UpdateDoctorProfileCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsEdit, cancellationToken);
        DoctorValidation.Profile(command.Profile);
        var profile = await store.FindAsync(command.DoctorProfileId, cancellationToken);
        if (profile is null) return false;
        if (await store.LicenseExistsAsync(command.Profile.LicenseNumber.Trim().ToUpperInvariant(), profile.Id, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Profile.LicenseNumber), "License number is already in use.");
        var input = command.Profile;
        profile.Update(input.Specialization, input.LicenseNumber, input.Bio, input.ConsultationDurationMinutes, clock.UtcNow);
        Audit(PlatformAuditAction.DoctorProfileUpdated, profile.Id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsEdit, cancellationToken);
        var profile = await store.FindAsync(id, cancellationToken);
        if (profile is null) return false;
        if (active) profile.Activate(clock.UtcNow); else profile.Deactivate(clock.UtcNow);
        Audit(active ? PlatformAuditAction.DoctorProfileActivated : PlatformAuditAction.DoctorProfileDeactivated, id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ArchiveAsync(Guid id, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsArchive, cancellationToken);
        var profile = await store.FindAsync(id, cancellationToken);
        if (profile is null) return false;
        profile.Archive(clock.UtcNow); Audit(PlatformAuditAction.DoctorProfileArchived, id);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new PlatformAuditLog(
        currentTenant.RequireTenantId(), currentUser.UserId, action, nameof(DoctorProfile), id, clock.UtcNow, null));
}
