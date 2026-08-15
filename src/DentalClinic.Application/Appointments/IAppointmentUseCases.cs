using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Appointments;

public interface IAppointmentQueries
{
    Task<AppointmentDetails?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<AppointmentSearchResult> SearchAsync(AppointmentSearchQuery query, CancellationToken cancellationToken);
}

public interface IAppointmentAvailabilityQuery
{
    Task<IReadOnlyCollection<AvailabilitySlot>> GetAsync(DoctorAvailabilityQuery query, CancellationToken cancellationToken);
}

public interface ICreateAppointment
{
    Task<Guid> ExecuteAsync(CreateAppointmentCommand command, CancellationToken cancellationToken);
}

public interface IRescheduleAppointment
{
    Task<bool> ExecuteAsync(RescheduleAppointmentCommand command, CancellationToken cancellationToken);
}

public interface IAppointmentLifecycle
{
    Task<bool> ConfirmAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> CancelAsync(Guid id, string reason, CancellationToken cancellationToken);
    Task<bool> CheckInAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> StartAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> CompleteAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> MarkNoShowAsync(Guid id, CancellationToken cancellationToken);
}
