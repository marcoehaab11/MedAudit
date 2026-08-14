using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Identity;

namespace DentalClinic.Application.Doctors;

public sealed record DoctorProfileInput(string Specialization, string LicenseNumber, string? Bio, int ConsultationDurationMinutes);
public sealed record CreateDoctorProfileCommand(Guid ClinicUserId, DoctorProfileInput Profile);
public sealed record UpdateDoctorProfileCommand(Guid DoctorProfileId, DoctorProfileInput Profile);
public sealed record DoctorSearchQuery(string? Search = null, DoctorProfileStatus? Status = null,
    string? Specialization = null, int Page = 1, int PageSize = 20);
public sealed record DoctorListItem(Guid Id, Guid ClinicUserId, string DisplayName, string Email,
    string? Phone, string Specialization, string LicenseNumber, DoctorProfileStatus Status, DateTimeOffset CreatedAt);
public sealed record DoctorProfileDetails(Guid Id, Guid ClinicUserId, string DisplayName, string Email,
    string? Phone, UserStatus AccountStatus, string Specialization, string LicenseNumber, string? Bio,
    int ConsultationDurationMinutes, DoctorProfileStatus Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    bool CanManageSchedule, bool CanManageCompensation);
public sealed record DoctorCandidate(Guid ClinicUserId, string DisplayName, string Email, string? Phone);

public sealed record ScheduleBreakInput(TimeOnly StartTime, TimeOnly EndTime);
public sealed record SchedulePeriodInput(DayOfWeek DayOfWeek, TimeOnly StartTime, TimeOnly EndTime,
    int SlotDurationMinutes, IReadOnlyCollection<ScheduleBreakInput> Breaks);
public sealed record ScheduleBreakModel(Guid Id, TimeOnly StartTime, TimeOnly EndTime);
public sealed record SchedulePeriodModel(Guid Id, DayOfWeek DayOfWeek, TimeOnly StartTime, TimeOnly EndTime,
    int SlotDurationMinutes, IReadOnlyCollection<ScheduleBreakModel> Breaks);

public sealed record DoctorCompensationInput(CompensationType CompensationType, decimal? FixedAmount,
    decimal? Percentage, DateOnly EffectiveFrom, DateOnly? EffectiveTo);
public sealed record CreateDoctorCompensationCommand(Guid DoctorProfileId, DoctorCompensationInput Compensation);
public sealed record UpdateDoctorCompensationCommand(Guid DoctorProfileId, DoctorCompensationInput Compensation);
public sealed record DoctorCompensationModel(Guid Id, CompensationType CompensationType, decimal? FixedAmount,
    decimal? Percentage, DateOnly EffectiveFrom, DateOnly? EffectiveTo, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
