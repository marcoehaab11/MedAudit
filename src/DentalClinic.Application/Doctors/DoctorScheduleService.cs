using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Doctors;

internal sealed class DoctorScheduleService(IDoctorScheduleStore store, IPermissionService permissions,
    ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock) : IDoctorScheduleService
{
    public async Task<IReadOnlyCollection<SchedulePeriodModel>?> GetAsync(Guid doctorProfileId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsView, cancellationToken);
        if (await store.FindDoctorAsync(doctorProfileId, cancellationToken) is null) return null;
        var periods = await store.GetAsync(doctorProfileId, false, cancellationToken);
        return periods.Select(Map).ToArray();
    }

    public async Task<bool> SetAsync(Guid doctorProfileId, IReadOnlyCollection<SchedulePeriodInput> periods, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsManageSchedule, cancellationToken);
        if (periods.Count > 28) throw DoctorValidation.Error(nameof(periods), "A weekly schedule cannot exceed 28 working periods.");
        var doctor = await store.FindDoctorAsync(doctorProfileId, cancellationToken);
        if (doctor is null) return false;
        if (doctor.Status == DoctorProfileStatus.Archived)
            throw DoctorValidation.Error(nameof(doctorProfileId), "Archived doctors cannot have their schedule modified.");
        var replacements = periods.Select(x => new DoctorSchedule(doctor.TenantId, doctor.Id, x.DayOfWeek,
            x.StartTime, x.EndTime, x.SlotDurationMinutes,
            x.Breaks.Select(b => (b.StartTime, b.EndTime)).ToArray(), clock.UtcNow)).ToArray();
        try { DoctorSchedule.EnsureNoOverlappingPeriods(replacements); }
        catch (ArgumentException exception) { throw DoctorValidation.Error(nameof(periods), exception.Message); }
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var existing = await store.GetAsync(doctorProfileId, true, cancellationToken);
        store.RemoveRange(existing); store.AddRange(replacements);
        store.AddAudit(new PlatformAuditLog(currentTenant.RequireTenantId(), currentUser.UserId,
            existing.Count == 0 ? PlatformAuditAction.DoctorScheduleCreated : PlatformAuditAction.DoctorScheduleUpdated,
            nameof(DoctorSchedule), doctorProfileId, clock.UtcNow, null));
        await store.SaveChangesAsync(cancellationToken); await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private static SchedulePeriodModel Map(DoctorSchedule x) => new(x.Id, x.DayOfWeek, x.StartTime, x.EndTime,
        x.SlotDurationMinutes, x.Breaks.OrderBy(b => b.StartTime)
            .Select(b => new ScheduleBreakModel(b.Id, b.StartTime, b.EndTime)).ToArray());
}
