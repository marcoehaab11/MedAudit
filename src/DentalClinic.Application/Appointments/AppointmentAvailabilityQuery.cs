using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;

namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentAvailabilityQuery(IAppointmentStore store, IPermissionService permissions,
    AppointmentAccess access) : IAppointmentAvailabilityQuery
{
    public async Task<IReadOnlyCollection<AvailabilitySlot>> GetAsync(
        DoctorAvailabilityQuery query, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.AppointmentsView, cancellationToken);
        if (query.DurationMinutes is < 5 or > 480)
            throw AppointmentRules.Error(nameof(query.DurationMinutes), "Duration must be between 5 and 480 minutes.");
        var visibleDoctor = await access.VisibleDoctorAsync(cancellationToken);
        if (visibleDoctor.HasValue && visibleDoctor.Value != query.DoctorProfileId) return [];
        var doctor = await store.FindDoctorAsync(query.DoctorProfileId, cancellationToken);
        if (doctor?.Status != DoctorProfileStatus.Active) return [];
        var schedule = await store.GetScheduleAsync(doctor.Id, cancellationToken);
        var periods = schedule.Where(x => x.DayOfWeek == query.Date.DayOfWeek).OrderBy(x => x.StartTime).ToArray();
        if (periods.Length == 0) return [];
        var timeZoneId = await store.GetTenantTimeZoneAsync(cancellationToken);
        var zone = AppointmentRules.ResolveTimeZone(timeZoneId);
        var dayRange = AppointmentRules.UtcRange(query.Date, query.Date, zone);
        var busy = await store.GetBusyPeriodsAsync(doctor.Id, dayRange.From, dayRange.To, null, cancellationToken);
        var result = new List<AvailabilitySlot>();
        foreach (var period in periods)
        {
            if (query.DurationMinutes % period.SlotDurationMinutes != 0) continue;
            for (var start = period.StartTime; start.AddMinutes(query.DurationMinutes) <= period.EndTime;
                 start = start.AddMinutes(period.SlotDurationMinutes))
            {
                var end = start.AddMinutes(query.DurationMinutes);
                if (period.Breaks.Any(x => start < x.EndTime && end > x.StartTime)) continue;
                DateTimeOffset utcStart;
                DateTimeOffset utcEnd;
                try
                {
                    utcStart = AppointmentRules.ToUtc(query.Date, start, zone);
                    utcEnd = AppointmentRules.ToUtc(query.Date, end, zone);
                }
                catch (FluentValidation.ValidationException) { continue; }
                if ((utcEnd - utcStart).TotalMinutes != query.DurationMinutes) continue;
                if (busy.Any(x => utcStart < x.EndAt && utcEnd > x.StartAt)) continue;
                result.Add(new AvailabilitySlot(utcStart, utcEnd, query.Date, start, end, timeZoneId));
            }
        }
        return result;
    }
}
