using DentalClinic.Domain.Doctors;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Appointments;

internal static class AppointmentRules
{
    public static ValidationException Error(string property, string message) =>
        new([new ValidationFailure(property, message)]);

    public static TimeZoneInfo ResolveTimeZone(string id)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { throw Error("TimeZone", "The clinic timezone is invalid."); }
        catch (InvalidTimeZoneException) { throw Error("TimeZone", "The clinic timezone is invalid."); }
    }

    public static DateTimeOffset ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(local)) throw Error("StartTime", "This local time does not exist in the clinic timezone.");
        if (zone.IsAmbiguousTime(local)) throw Error("StartTime", "This local time is ambiguous in the clinic timezone.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone), TimeSpan.Zero);
    }

    public static (DateTimeOffset From, DateTimeOffset To) UtcRange(DateOnly from, DateOnly to, TimeZoneInfo zone)
    {
        if (to < from) throw Error("To", "End date cannot precede start date.");
        if (to.DayNumber - from.DayNumber > 31) throw Error("To", "Appointment searches cannot exceed 31 days.");
        return (ToUtc(from, TimeOnly.MinValue, zone), ToUtc(to.AddDays(1), TimeOnly.MinValue, zone));
    }

    public static void EnsureScheduleFit(IReadOnlyCollection<DoctorSchedule> schedule,
        DateOnly date, TimeOnly startTime, int durationMinutes)
    {
        if (durationMinutes is < 5 or > 480) throw Error("DurationMinutes", "Duration must be between 5 and 480 minutes.");
        var localStart = date.ToDateTime(startTime);
        var localEnd = localStart.AddMinutes(durationMinutes);
        if (DateOnly.FromDateTime(localEnd) != date)
            throw Error("StartTime", "An appointment must finish on the same local clinic date.");
        var endTime = TimeOnly.FromDateTime(localEnd);
        var period = schedule.FirstOrDefault(x => x.DayOfWeek == localStart.DayOfWeek &&
            startTime >= x.StartTime && endTime <= x.EndTime);
        if (period is null) throw Error("StartTime", "The appointment is outside the doctor's working schedule.");
        var offsetMinutes = (int)(startTime - period.StartTime).TotalMinutes;
        if (durationMinutes % period.SlotDurationMinutes != 0 || offsetMinutes % period.SlotDurationMinutes != 0)
            throw Error("DurationMinutes", "The appointment must align with the doctor's slot duration.");
        if (period.Breaks.Any(x => startTime < x.EndTime && endTime > x.StartTime))
            throw Error("StartTime", "The appointment overlaps a doctor break.");
    }
}
