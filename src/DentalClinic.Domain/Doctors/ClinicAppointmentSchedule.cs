using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Domain.Doctors;

public static class ClinicAppointmentSchedule
{
    public static IReadOnlyCollection<DoctorSchedule> Resolve(Guid tenantId, Guid doctorId,
        IReadOnlyCollection<ClinicHours> hours, IReadOnlyCollection<DoctorSchedule> fallback)
    {
        if (hours.Count == 0) return fallback;
        var result = new List<DoctorSchedule>();
        foreach (var day in hours.Where(x => x.IsOpen))
        foreach (var work in day.Periods.Where(p => p.PeriodType == ClinicPeriodType.Work))
        {
            if (fallback.Count == 0)
            {
                result.Add(new(tenantId, doctorId, day.DayOfWeek, work.StartTime, work.EndTime, 1, [], DateTimeOffset.UnixEpoch));
                continue;
            }
            foreach (var doctor in fallback.Where(x => x.DayOfWeek == day.DayOfWeek && x.StartTime < work.EndTime && x.EndTime > work.StartTime))
            {
                var start = doctor.StartTime > work.StartTime ? doctor.StartTime : work.StartTime;
                var end = doctor.EndTime < work.EndTime ? doctor.EndTime : work.EndTime;
                var breaks = doctor.Breaks.Where(x => x.StartTime < end && x.EndTime > start)
                    .Select(x => (x.StartTime < start ? start : x.StartTime, x.EndTime > end ? end : x.EndTime)).ToArray();
                result.Add(new(tenantId, doctorId, day.DayOfWeek, start, end, 1, breaks, DateTimeOffset.UnixEpoch));
            }
        }
        return result;
    }
}
