using DentalClinic.Application.Appointments;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.PublicBooking;

public interface IPublicBookingStore
{
    Task<PublicClinicDto?> FindClinicBySlugAsync(string slug, CancellationToken token);
    Task<Guid?> FindTenantIdBySlugAsync(string slug, CancellationToken token);
    Task<IReadOnlyCollection<PublicDoctorDto>> GetEligibleDoctorsAsync(Guid tenantId, CancellationToken token);
    Task<DoctorProfile?> FindDoctorAsync(Guid tenantId, Guid doctorProfileId, CancellationToken token);
    Task<IReadOnlyCollection<DoctorSchedule>> GetDoctorScheduleAsync(Guid doctorProfileId, CancellationToken token);
    Task<IReadOnlyCollection<AppointmentBusyPeriod>> GetBusyPeriodsAsync(Guid doctorProfileId, DateTimeOffset rangeStart, DateTimeOffset rangeEnd, CancellationToken token);
    Task<IReadOnlyCollection<PublicServiceDto>> GetEligibleServicesAsync(Guid tenantId, bool priceVisibility, CancellationToken token);
    Task<TreatmentCatalogItem?> FindServiceAsync(Guid tenantId, Guid serviceId, CancellationToken token);
    Task<Patient?> FindPatientByNormalizedPhoneAsync(Guid tenantId, string normalizedPhone, CancellationToken token);
    Task AddPatientAsync(Patient patient, CancellationToken token);
    Task AddAppointmentAsync(Appointment appointment, CancellationToken token);
    Task<PublicBookingIdempotencyRecord?> FindIdempotencyRecordAsync(Guid tenantId, string idempotencyKey, CancellationToken token);
    Task AddIdempotencyRecordAsync(PublicBookingIdempotencyRecord record, CancellationToken token);
    Task<Appointment?> FindBookingByReferenceAsync(string reference, CancellationToken token);
    Task<PublicBookingConfirmationDto?> GetBookingConfirmationAsync(string reference, CancellationToken token);
    Task<string> GetNextPatientNumberAsync(Guid tenantId, CancellationToken token);
    Task CommitTransactionAsync(CancellationToken token);
}
