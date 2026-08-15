namespace DentalClinic.Contracts.Appointments;

public sealed record AppointmentTimeRequest(DateOnly Date, TimeOnly StartTime, int DurationMinutes);
public sealed record CreateAppointmentRequest(Guid PatientId, Guid DoctorProfileId, int Type,
    AppointmentTimeRequest Time, string? Notes);
public sealed record RescheduleAppointmentRequest(AppointmentTimeRequest Time);
public sealed record CancelAppointmentRequest(string Reason);
