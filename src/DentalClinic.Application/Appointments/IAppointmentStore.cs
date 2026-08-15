using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Appointments;

public interface IAppointmentStore
{
    Task<Patient?> FindPatientAsync(Guid id, CancellationToken cancellationToken);
    Task<DoctorProfile?> FindDoctorAsync(Guid id, CancellationToken cancellationToken);
    Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<string> GetTenantTimeZoneAsync(CancellationToken cancellationToken);
    Task<IReadOnlyCollection<DoctorSchedule>> GetScheduleAsync(Guid doctorProfileId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<AppointmentBusyPeriod>> GetBusyPeriodsAsync(Guid doctorProfileId,
        DateTimeOffset rangeStart, DateTimeOffset rangeEnd, Guid? excludeAppointmentId, CancellationToken cancellationToken);
    Task<bool> HasConflictAsync(Guid doctorProfileId, Guid patientId, DateTimeOffset startAt,
        DateTimeOffset endAt, Guid? excludeAppointmentId, CancellationToken cancellationToken);
    Task<Appointment?> FindAsync(Guid id, bool tracking, CancellationToken cancellationToken);
    Task<AppointmentDetails?> GetDetailsAsync(Guid id, Guid? visibleDoctorProfileId, CancellationToken cancellationToken);
    Task<PagedResult<AppointmentListItem>> SearchAsync(AppointmentSearchQuery query, DateTimeOffset rangeStart,
        DateTimeOffset rangeEnd, Guid? visibleDoctorProfileId, string timeZone, CancellationToken cancellationToken);
    void Add(Appointment appointment);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
