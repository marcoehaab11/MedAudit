using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Doctors;

internal sealed class DoctorProfileCommands(IDoctorProfileStore store, IDoctorScheduleStore scheduleStore, IPermissionService permissions,
    ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock) : IDoctorProfileCommands
{
    public async Task<Guid> CreateAsync(CreateDoctorProfileCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsCreate, cancellationToken);
        DoctorValidation.Profile(command.Profile);
        if (!await store.IsDoctorUserAsync(command.ClinicUserId, cancellationToken))
            throw DoctorValidation.Error(nameof(command.ClinicUserId), "The selected clinic user must have the Doctor role in this tenant.");

        var existingProfile = await store.FindByUserIdAsync(command.ClinicUserId, cancellationToken);
        if (existingProfile != null)
        {
            if (!string.IsNullOrWhiteSpace(command.Profile.LicenseNumber) &&
                await store.LicenseExistsAsync(command.Profile.LicenseNumber.Trim().ToUpperInvariant(), existingProfile.Id, cancellationToken))
                throw DoctorValidation.Error(nameof(command.Profile.LicenseNumber), "License number is already in use.");

            var input = command.Profile;
            existingProfile.Update(input.Specialization, input.LicenseNumber, input.Bio, input.ConsultationDurationMinutes, clock.UtcNow);
            Audit(PlatformAuditAction.DoctorProfileUpdated, existingProfile.Id);

            var schedules = await scheduleStore.GetAsync(existingProfile.Id, false, cancellationToken);
            if (schedules.Count == 0)
            {
                var duration = input.ConsultationDurationMinutes;
                var maxWorkingMinutes = 1440 - (1440 % duration);
                if (maxWorkingMinutes == 1440) maxWorkingMinutes = 1440 - duration;
                var defaultEndTime = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(maxWorkingMinutes));

                var defaultSchedules = Enum.GetValues<DayOfWeek>().Select(day => 
                    new DoctorSchedule(existingProfile.TenantId, existingProfile.Id, day, new TimeOnly(0, 0), defaultEndTime, duration, [], clock.UtcNow)
                );
                scheduleStore.AddRange(defaultSchedules);
            }

            await store.SaveChangesAsync(cancellationToken);
            return existingProfile.Id;
        }

        if (!string.IsNullOrWhiteSpace(command.Profile.LicenseNumber) &&
            await store.LicenseExistsAsync(command.Profile.LicenseNumber.Trim().ToUpperInvariant(), null, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Profile.LicenseNumber), "License number is already in use.");

        var inputNew = command.Profile;
        var profile = new DoctorProfile(currentTenant.RequireTenantId(), command.ClinicUserId,
            inputNew.Specialization, inputNew.LicenseNumber, inputNew.Bio, inputNew.ConsultationDurationMinutes, clock.UtcNow);
        store.Add(profile); Audit(PlatformAuditAction.DoctorProfileCreated, profile.Id);

        var durationNew = inputNew.ConsultationDurationMinutes;
        var maxWorkingMinutesNew = 1440 - (1440 % durationNew);
        if (maxWorkingMinutesNew == 1440) maxWorkingMinutesNew = 1440 - durationNew;
        var defaultEndTimeNew = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(maxWorkingMinutesNew));

        var defaultSchedulesNew = Enum.GetValues<DayOfWeek>().Select(day => 
            new DoctorSchedule(profile.TenantId, profile.Id, day, new TimeOnly(0, 0), defaultEndTimeNew, durationNew, [], clock.UtcNow)
        );
        scheduleStore.AddRange(defaultSchedulesNew);

        await store.SaveChangesAsync(cancellationToken);
        return profile.Id;
    }

    public async Task<bool> UpdateAsync(UpdateDoctorProfileCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsEdit, cancellationToken);
        DoctorValidation.Profile(command.Profile);
        var profile = await store.FindAsync(command.DoctorProfileId, cancellationToken);
        if (profile is null) return false;
        if (!string.IsNullOrWhiteSpace(command.Profile.LicenseNumber) &&
            await store.LicenseExistsAsync(command.Profile.LicenseNumber.Trim().ToUpperInvariant(), profile.Id, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Profile.LicenseNumber), "License number is already in use.");
        var input = command.Profile;
        profile.Update(input.Specialization, input.LicenseNumber, input.Bio, input.ConsultationDurationMinutes, clock.UtcNow);

        if (!string.IsNullOrWhiteSpace(input.DisplayName))
        {
            var user = await store.FindClinicUserAsync(profile.ClinicUserId, cancellationToken);
            if (user != null)
            {
                user.Update(input.DisplayName.Trim(), input.Phone?.Trim(), clock.UtcNow);
            }
        }

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

    public async Task<bool> RestoreAsync(Guid id, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsArchive, cancellationToken);
        var profile = await store.FindAsync(id, cancellationToken);
        if (profile is null) return false;
        profile.Restore(clock.UtcNow);
        Audit(PlatformAuditAction.DoctorProfileRestored, id);

        var schedules = await scheduleStore.GetAsync(profile.Id, false, cancellationToken);
        if (schedules.Count == 0)
        {
            var duration = profile.ConsultationDurationMinutes;
            var maxWorkingMinutes = 1440 - (1440 % duration);
            if (maxWorkingMinutes == 1440) maxWorkingMinutes = 1440 - duration;
            var defaultEndTime = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(maxWorkingMinutes));

            var defaultSchedules = Enum.GetValues<DayOfWeek>().Select(day => 
                new DoctorSchedule(profile.TenantId, profile.Id, day, new TimeOnly(0, 0), defaultEndTime, duration, [], clock.UtcNow)
            );
            scheduleStore.AddRange(defaultSchedules);
        }

        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new PlatformAuditLog(
        currentTenant.RequireTenantId(), currentUser.UserId, action, nameof(DoctorProfile), id, clock.UtcNow, null));
}
