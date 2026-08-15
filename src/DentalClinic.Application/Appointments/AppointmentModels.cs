using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Appointments;

namespace DentalClinic.Application.Appointments;

public sealed record AppointmentTimeInput(DateOnly Date, TimeOnly StartTime, int DurationMinutes);
public sealed record CreateAppointmentCommand(Guid PatientId, Guid DoctorProfileId, AppointmentType Type,
    AppointmentTimeInput Time, string? Notes);
public sealed record RescheduleAppointmentCommand(Guid AppointmentId, AppointmentTimeInput Time);
public sealed record AppointmentSearchQuery(DateOnly From, DateOnly To, Guid? DoctorProfileId = null,
    Guid? PatientId = null, AppointmentStatus? Status = null, AppointmentType? Type = null,
    int Page = 1, int PageSize = 100);
public sealed record DoctorAvailabilityQuery(Guid DoctorProfileId, DateOnly Date, int DurationMinutes);
public sealed record AppointmentListItem(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, AppointmentType Type, AppointmentStatus Status, DateTimeOffset StartAt,
    DateTimeOffset EndAt, int DurationMinutes, string TimeZone);
public sealed record AppointmentDetails(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, AppointmentType Type, AppointmentStatus Status, DateTimeOffset StartAt,
    DateTimeOffset EndAt, int DurationMinutes, string? Notes, string? CancellationReason,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ConfirmedAt,
    DateTimeOffset? CheckedInAt, DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt,
    string TimeZone);
public sealed record AvailabilitySlot(DateTimeOffset StartAt, DateTimeOffset EndAt,
    DateOnly LocalDate, TimeOnly LocalStartTime, TimeOnly LocalEndTime, string TimeZone);
public sealed record AppointmentBusyPeriod(DateTimeOffset StartAt, DateTimeOffset EndAt);
public sealed record AppointmentSearchResult(PagedResult<AppointmentListItem> Page, string TimeZone);

public sealed class AppointmentConflictException(string message) : Exception(message);
