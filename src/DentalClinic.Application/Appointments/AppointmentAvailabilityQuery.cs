using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;

namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentAvailabilityQuery(IAppointmentStore store, IPermissionService permissions) : IAppointmentAvailabilityQuery
{
    public async Task<IReadOnlyCollection<AvailabilitySlot>> GetAsync(
        DoctorAvailabilityQuery query, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.AppointmentsView, cancellationToken);
        if (query.DurationMinutes is < 5 or > 480)
            throw AppointmentRules.Error(nameof(query.DurationMinutes), "Duration must be between 5 and 480 minutes.");
        var doctor = await store.FindDoctorAsync(query.DoctorProfileId, cancellationToken);
        if (doctor?.Status != DoctorProfileStatus.Active) return [];
        var timeZoneId = await store.GetTenantTimeZoneAsync(cancellationToken);
        var zone = AppointmentRules.ResolveTimeZone(timeZoneId);
        var dayRange = AppointmentRules.UtcRange(query.Date, query.Date, zone);
        var busy = await store.GetBusyPeriodsAsync(doctor.Id, dayRange.From, dayRange.To, null, cancellationToken);

        if (query.IsEmergency)
        {
            var resultEmergency = new List<AvailabilitySlot>();
            for (var minute = 0; minute + query.DurationMinutes <= 1440; minute += query.DurationMinutes)
            {
                var start = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(minute));
                var endMinutes = minute + query.DurationMinutes;
                var end = endMinutes == 1440 
                    ? new TimeOnly(0, 0) 
                    : TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(endMinutes));

                var localStart = query.Date.ToDateTime(start, DateTimeKind.Unspecified);
                var localEnd = localStart.AddMinutes(query.DurationMinutes);
                DateTimeOffset utcStart;
                DateTimeOffset utcEnd;
                try
                {
                    utcStart = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, zone), TimeSpan.Zero);
                    utcEnd = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localEnd, zone), TimeSpan.Zero);
                }
                catch { continue; }

                if (Math.Round((utcEnd - utcStart).TotalMinutes) != query.DurationMinutes) continue;
                if (busy.Any(x => utcStart < x.EndAt && utcEnd > x.StartAt)) continue;
                resultEmergency.Add(new AvailabilitySlot(utcStart, utcEnd, query.Date, start, end, timeZoneId));
            }
            return resultEmergency;
        }

        var schedule = await store.GetScheduleAsync(doctor.Id, cancellationToken);
        var periods = schedule.Where(x => x.DayOfWeek == query.Date.DayOfWeek).OrderBy(x => x.StartTime).ToArray();
        if (periods.Length == 0) return [];
        var result = new List<AvailabilitySlot>();
        foreach (var period in periods)
        {
            if (query.DurationMinutes % period.SlotDurationMinutes != 0) continue;
            var startMins = (int)period.StartTime.ToTimeSpan().TotalMinutes;
            var endMins = (int)period.EndTime.ToTimeSpan().TotalMinutes;
            var adjustedEndMins = endMins == 1439 ? 1440 : endMins;

            for (var currentMins = startMins; currentMins + query.DurationMinutes <= adjustedEndMins; currentMins += period.SlotDurationMinutes)
            {
                var start = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(currentMins));
                var endMinutes = currentMins + query.DurationMinutes;
                var end = endMinutes == 1440 ? new TimeOnly(0, 0) : TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(endMinutes));

                if (period.Breaks.Any(x => start < x.EndTime && (end > x.StartTime || end.Minute == 0 && end.Hour == 0))) continue;
                DateTimeOffset utcStart;
                DateTimeOffset utcEnd;
                try
                {
                    utcStart = AppointmentRules.ToUtc(query.Date, start, zone);
                    utcEnd = endMinutes == 1440 
                        ? AppointmentRules.ToUtc(query.Date.AddDays(1), end, zone) 
                        : AppointmentRules.ToUtc(query.Date, end, zone);
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
