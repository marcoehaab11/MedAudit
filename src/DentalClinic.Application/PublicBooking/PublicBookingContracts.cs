namespace DentalClinic.Application.PublicBooking;

public sealed record PublicClinicDto(
    string Name,
    string Slug,
    string Phone,
    string Email,
    string Address,
    string City,
    string Country,
    string TimeZone,
    string Currency,
    string? LogoReference,
    bool PublicBookingEnabled,
    int PublicBookingHorizonDays,
    bool PublicPriceVisibility,
    string? ArabicName,
    string? Description,
    string? ArabicDescription,
    string? Website,
    IReadOnlyCollection<PublicClinicHoursDto> Hours
);

public sealed record PublicClinicHoursDto(DayOfWeek DayOfWeek, bool IsOpen,
    IReadOnlyCollection<PublicClinicHourPeriodDto> Periods);
public sealed record PublicClinicHourPeriodDto(string StartTime, string EndTime);

public sealed record PublicDoctorDto(
    Guid DoctorProfileId,
    string DisplayName,
    string Specialization,
    string? Bio,
    int ConsultationDurationMinutes
);

public sealed record PublicServiceDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    int DurationMinutes,
    decimal? Price
);

public sealed record PublicAvailabilitySlotDto(
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    string TimeZone
);

public sealed record PublicBookingRequest(
    string ClinicSlug,
    Guid DoctorProfileId,
    Guid ServiceId,
    DateTimeOffset StartAt,
    int DurationMinutes,
    string PatientName,
    string PatientPhone,
    string? PatientEmail,
    DateOnly? PatientDateOfBirth,
    string? PatientNotes,
    string? IdempotencyKey,
    string? Source = null
);

public sealed record PublicBookingInquiryRequest(string PatientName, string PatientPhone,
    string? PatientEmail, string? Message, string? Source = null);

public sealed record PublicBookingConfirmationDto(
    string BookingReference,
    string ClinicName,
    string DoctorName,
    string ServiceName,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    string TimeZone,
    string PatientName,
    string PatientPhone,
    string Status,
    string? ManagementToken = null
);
