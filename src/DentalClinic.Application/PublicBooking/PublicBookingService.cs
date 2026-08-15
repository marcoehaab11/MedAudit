using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.PublicBooking;

public sealed class PublicBookingNotFoundException(string message) : Exception(message);
public sealed class PublicBookingDisabledException(string message) : Exception(message);
public sealed class PublicBookingConflictException(string message) : Exception(message);

internal sealed partial class PublicBookingService(
    IPublicBookingStore store,
    ISystemClock clock
) : IPublicBookingService
{
    public async Task<PublicClinicDto> GetClinicBySlugAsync(string slug, CancellationToken token)
    {
        var clinic = await store.FindClinicBySlugAsync(slug, token)
            ?? throw new PublicBookingNotFoundException("Clinic not found.");

        if (!clinic.PublicBookingEnabled)
        {
            throw new PublicBookingDisabledException("Public booking is not enabled for this clinic.");
        }

        return clinic;
    }

    public async Task<IReadOnlyCollection<PublicDoctorDto>> GetDoctorsAsync(string slug, CancellationToken token)
    {
        var clinic = await GetClinicBySlugAsync(slug, token);
        var tenantId = await GetTenantIdAsync(slug, token);
        return await store.GetEligibleDoctorsAsync(tenantId, token);
    }

    public async Task<IReadOnlyCollection<PublicServiceDto>> GetServicesAsync(string slug, CancellationToken token)
    {
        var clinic = await GetClinicBySlugAsync(slug, token);
        var tenantId = await GetTenantIdAsync(slug, token);
        return await store.GetEligibleServicesAsync(tenantId, clinic.PublicPriceVisibility, token);
    }

    public async Task<IReadOnlyCollection<PublicAvailabilitySlotDto>> GetAvailabilityAsync(
        string slug, Guid doctorProfileId, DateOnly bookingDate, Guid? serviceId, CancellationToken token)
    {
        var clinic = await GetClinicBySlugAsync(slug, token);
        var tenantId = await GetTenantIdAsync(slug, token);
        var doctor = await store.FindDoctorAsync(tenantId, doctorProfileId, token);
        if (doctor == null || doctor.Status != DoctorProfileStatus.Active || !doctor.IsPublicBookingEnabled)
        {
            return [];
        }

        int durationMinutes = doctor.ConsultationDurationMinutes;
        if (serviceId.HasValue)
        {
            var service = await store.FindServiceAsync(tenantId, serviceId.Value, token);
            if (service != null && service.IsActive && service.IsPublicBookingEnabled)
            {
                durationMinutes = service.DurationMinutes;
            }
        }

        var zone = ResolveTimeZone(clinic.TimeZone);
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow, zone).DateTime);

        if (bookingDate < todayLocal || bookingDate > todayLocal.AddDays(clinic.PublicBookingHorizonDays))
        {
            return [];
        }

        var schedule = await store.GetDoctorScheduleAsync(doctor.Id, token);
        var periods = schedule.Where(x => x.DayOfWeek == bookingDate.DayOfWeek).OrderBy(x => x.StartTime).ToArray();
        if (periods.Length == 0) return [];

        var dayRange = AppointmentRules.UtcRange(bookingDate, bookingDate, zone);
        var busy = await store.GetBusyPeriodsAsync(doctor.Id, dayRange.From, dayRange.To, token);

        var result = new List<PublicAvailabilitySlotDto>();
        foreach (var period in periods)
        {
            if (durationMinutes % period.SlotDurationMinutes != 0) continue;
            for (var start = period.StartTime; start.AddMinutes(durationMinutes) <= period.EndTime;
                 start = start.AddMinutes(period.SlotDurationMinutes))
            {
                var end = start.AddMinutes(durationMinutes);
                if (period.Breaks.Any(x => start < x.EndTime && end > x.StartTime)) continue;
                DateTimeOffset utcStart;
                DateTimeOffset utcEnd;
                try
                {
                    utcStart = AppointmentRules.ToUtc(bookingDate, start, zone);
                    utcEnd = AppointmentRules.ToUtc(bookingDate, end, zone);
                }
                catch (FluentValidation.ValidationException) { continue; }

                if ((utcEnd - utcStart).TotalMinutes != durationMinutes) continue;
                if (utcStart < clock.UtcNow) continue; // Past time slots in today's local date
                if (busy.Any(x => utcStart < x.EndAt && utcEnd > x.StartAt)) continue;

                result.Add(new PublicAvailabilitySlotDto(utcStart, utcEnd, bookingDate, start, end, clinic.TimeZone));
            }
        }

        return result;
    }

    public async Task<PublicBookingConfirmationDto> CreateBookingAsync(PublicBookingRequest request, CancellationToken token)
    {
        var clinic = await GetClinicBySlugAsync(request.ClinicSlug, token);
        var tenantId = await GetTenantIdAsync(request.ClinicSlug, token);

        var requestHash = ComputeRequestHash(request);

        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingRecord = await store.FindIdempotencyRecordAsync(tenantId, request.IdempotencyKey, token);
            if (existingRecord != null)
            {
                if (existingRecord.RequestHash != requestHash)
                {
                    throw new PublicBookingConflictException("Idempotency key was reused with a different booking request payload.");
                }

                var confirmation = await store.GetBookingConfirmationAsync(existingRecord.BookingReference, token);
                if (confirmation != null)
                {
                    return confirmation;
                }
            }
        }

        var doctor = await store.FindDoctorAsync(tenantId, request.DoctorProfileId, token);
        if (doctor == null || doctor.Status != DoctorProfileStatus.Active || !doctor.IsPublicBookingEnabled)
        {
            throw new PublicBookingNotFoundException("Selected doctor is unavailable for public booking.");
        }

        var service = await store.FindServiceAsync(tenantId, request.ServiceId, token);
        if (service == null || !service.IsActive || !service.IsPublicBookingEnabled)
        {
            throw new PublicBookingNotFoundException("Selected service is unavailable for public booking.");
        }

        int durationMinutes = service.DurationMinutes;
        var zone = ResolveTimeZone(clinic.TimeZone);
        var dateLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(request.StartAt, zone).DateTime);
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow, zone).DateTime);

        if (dateLocal < todayLocal || dateLocal > todayLocal.AddDays(clinic.PublicBookingHorizonDays))
        {
            throw new ArgumentException("Booking date is outside the allowed booking horizon.");
        }

        // Server-side slot availability revalidation
        var utcEnd = request.StartAt.AddMinutes(durationMinutes);
        var dayRange = AppointmentRules.UtcRange(dateLocal, dateLocal, zone);
        var busy = await store.GetBusyPeriodsAsync(doctor.Id, dayRange.From, dayRange.To, token);
        if (busy.Any(x => request.StartAt < x.EndAt && utcEnd > x.StartAt))
        {
            throw new PublicBookingConflictException("That time slot is no longer available. Please select another slot.");
        }

        // Patient matching strategy: Tenant + Normalized Phone
        var normalizedPhone = NormalizePhone(request.PatientPhone);
        var patient = await store.FindPatientByNormalizedPhoneAsync(tenantId, normalizedPhone, token);

        var isExistingPatient = patient != null;
        if (patient == null)
        {
            var patientNumber = await store.GetNextPatientNumberAsync(tenantId, token);
            var (firstName, lastName) = SplitName(request.PatientName);

            patient = new Patient(
                tenantId,
                patientNumber,
                firstName,
                null,
                lastName,
                PatientGender.NotSpecified,
                request.PatientDateOfBirth ?? DateOnly.FromDateTime(new DateTime(1990, 1, 1)),
                normalizedPhone,
                null,
                request.PatientEmail,
                null, null, null, null, null, null, null, null,
                request.PatientNotes,
                null,
                clock.UtcNow
            );

            await store.AddPatientAsync(patient, token);
        }

        var reference = GenerateBookingReference();
        var creatorUserId = doctor.ClinicUserId;
        var apptType = isExistingPatient ? AppointmentType.FollowUp : AppointmentType.NewPatient;

        var appointment = new Appointment(
            tenantId,
            patient.Id,
            doctor.Id,
            apptType,
            request.StartAt,
            durationMinutes,
            request.PatientNotes,
            creatorUserId,
            clock.UtcNow,
            reference,
            service.Id
        );

        await store.AddAppointmentAsync(appointment, token);

        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            await store.AddIdempotencyRecordAsync(
                new PublicBookingIdempotencyRecord(tenantId, request.IdempotencyKey, requestHash, reference, clock.UtcNow),
                token
            );
        }

        await store.CommitTransactionAsync(token);

        return (await store.GetBookingConfirmationAsync(reference, token))
            ?? throw new InvalidOperationException("Failed to load created booking confirmation.");
    }

    public async Task<PublicBookingConfirmationDto?> GetBookingByReferenceAsync(string reference, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(reference)) return null;
        return await store.GetBookingConfirmationAsync(reference.Trim(), token);
    }

    private async Task<Guid> GetTenantIdAsync(string slug, CancellationToken token)
    {
        return await store.FindTenantIdBySlugAsync(slug, token)
            ?? throw new PublicBookingNotFoundException("Clinic not found.");
    }

    private static string ComputeRequestHash(PublicBookingRequest request)
    {
        var raw = $"{request.ClinicSlug}:{request.DoctorProfileId}:{request.ServiceId}:{request.StartAt.ToUnixTimeSeconds()}:{request.DurationMinutes}:{NormalizePhone(request.PatientPhone)}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
    }

    private static string NormalizePhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) throw new ArgumentException("Phone number is required.", nameof(phone));
        return NonDigitsRegex().Replace(phone.Trim(), "");
    }

    private static (string FirstName, string LastName) SplitName(string name)
    {
        var trimmed = (name ?? "Public Patient").Trim();
        var parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return (parts[0], "Patient");
        return (parts[0], string.Join(' ', parts.Skip(1)));
    }

    private static string GenerateBookingReference()
    {
        var bytes = new byte[6];
        RandomNumberGenerator.Fill(bytes);
        var alphaNumeric = Convert.ToHexString(bytes).ToUpperInvariant()[..8];
        return $"BK-{alphaNumeric}";
    }

    [GeneratedRegex(@"[^\d]", RegexOptions.Compiled)]
    private static partial Regex NonDigitsRegex();
}
