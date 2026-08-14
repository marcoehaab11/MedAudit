namespace DentalClinic.Contracts.Doctors;

public sealed record DoctorProfileRequest(Guid ClinicUserId, string Specialization, string LicenseNumber,
    string? Bio, int ConsultationDurationMinutes);
public sealed record UpdateDoctorProfileRequest(string Specialization, string LicenseNumber,
    string? Bio, int ConsultationDurationMinutes);
public sealed record ScheduleBreakRequest(TimeOnly StartTime, TimeOnly EndTime);
public sealed record SchedulePeriodRequest(int DayOfWeek, TimeOnly StartTime, TimeOnly EndTime,
    int SlotDurationMinutes, IReadOnlyCollection<ScheduleBreakRequest> Breaks);
public sealed record DoctorScheduleRequest(IReadOnlyCollection<SchedulePeriodRequest> Periods);
public sealed record DoctorCompensationRequest(int CompensationType, decimal? FixedAmount,
    decimal? Percentage, DateOnly EffectiveFrom, DateOnly? EffectiveTo);
