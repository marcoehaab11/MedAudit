namespace DentalClinic.Application.PublicBooking;

public interface IPublicBookingService
{
    Task<PublicClinicDto> GetClinicBySlugAsync(string slug, CancellationToken token);
    Task<IReadOnlyCollection<PublicDoctorDto>> GetDoctorsAsync(string slug, CancellationToken token);
    Task<IReadOnlyCollection<PublicServiceDto>> GetServicesAsync(string slug, CancellationToken token);
    Task<IReadOnlyCollection<PublicAvailabilitySlotDto>> GetAvailabilityAsync(string slug, Guid doctorProfileId, DateOnly bookingDate, Guid? serviceId, CancellationToken token);
    Task<PublicBookingConfirmationDto> CreateBookingAsync(PublicBookingRequest request, CancellationToken token);
    Task<PublicBookingConfirmationDto?> GetBookingByReferenceAsync(string reference, CancellationToken token);
}
