using DentalClinic.Application.PublicBooking;
using QRCoder;
using System.Security.Cryptography;
using System.Text;
using DentalClinic.Domain.Appointments;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Notifications;
using DentalClinic.Application.Identity;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static partial class PublicBookingEndpoints
{
    [LoggerMessage(EventId = 4100, Level = LogLevel.Error, Message = "Could not queue public booking alert for {EntityId}")]
    private static partial void LogAlertFailure(ILogger logger, Guid entityId, Exception exception);

    private static async Task QueueAlertSafelyAsync(ApplicationDbContext db, ILogger logger, Guid tenantId,
        string eventType, string permission, string title, string body, string entityType, Guid entityId,
        string key, CancellationToken token)
    {
        try { await ClinicAlertDispatcher.EnqueueAsync(db, tenantId, eventType, permission, title, body, entityType, entityId, key, token); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogAlertFailure(logger, entityId, ex);
            db.ChangeTracker.Clear();
        }
    }

    public static IEndpointRouteBuilder MapPublicBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/public").AllowAnonymous()
            .AddEndpointFilter(new DatabaseAccessFilter("booking"));

        api.MapGet("/clinics/{slug}/qr", async (string slug, HttpContext context,
            IPublicBookingService service, CancellationToken token) =>
        {
            try
            {
                var clinic = await service.GetClinicBySlugAsync(slug, token);
                var host = context.Request.Host.Host;
                var baseHost = host.StartsWith("app.", StringComparison.OrdinalIgnoreCase) ? host[4..]
                    : host.StartsWith("admin.", StringComparison.OrdinalIgnoreCase) ? host[6..]
                    : host.StartsWith("book.", StringComparison.OrdinalIgnoreCase) ? host[5..] : host;
                var local = baseHost is "localhost" or "127.0.0.1";
                var publicHost = $"book.{(local ? "localhost" : baseHost)}";
                var port = local && (host is "localhost" or "127.0.0.1") ? 8080 : context.Request.Host.Port;
                var url = $"{context.Request.Scheme}://{publicHost}{(port is { } number ? $":{number}" : "")}/book/{Uri.EscapeDataString(clinic.Slug)}?source=qr";
                using var data = QRCodeGenerator.GenerateQrCode(url, QRCodeGenerator.ECCLevel.Q);
                using var qr = new SvgQRCode(data);
                return Results.Content(qr.GetGraphic(6), "image/svg+xml");
            }
            catch (PublicBookingNotFoundException) { return Results.NotFound(); }
            catch (PublicBookingDisabledException) { return Results.NotFound(); }
        });

        api.MapGet("/clinics/{slug}", async (string slug, IPublicBookingService s, CancellationToken t) =>
        {
            try
            {
                var clinic = await s.GetClinicBySlugAsync(slug, t);
                return Results.Ok(clinic);
            }
            catch (PublicBookingNotFoundException ex)
            {
                return Results.NotFound(new { title = ex.Message });
            }
            catch (PublicBookingDisabledException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
        });

        api.MapPost("/clinics/{slug}/visits", async (string slug, VisitInput request,
            ApplicationDbContext db, IPublicBookingService service, CancellationToken token) =>
        {
            try { await service.GetClinicBySlugAsync(slug, token); }
            catch (Exception ex) when (ex is PublicBookingNotFoundException or PublicBookingDisabledException) { return Results.NotFound(); }
            var tenantId = await db.Tenants.AsNoTracking().IgnoreQueryFilters()
                .Where(x => x.Slug == slug).Select(x => x.Id).SingleAsync(token);
            var source = NormalizeSource(request.Source);
            db.BookingPageVisits.Add(new BookingPageVisit(tenantId, source, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(token);
            return Results.NoContent();
        });

        api.MapGet("/clinics/{slug}/doctors", async (string slug, IPublicBookingService s, CancellationToken t) =>
        {
            try
            {
                var doctors = await s.GetDoctorsAsync(slug, t);
                return Results.Ok(doctors);
            }
            catch (PublicBookingNotFoundException ex)
            {
                return Results.NotFound(new { title = ex.Message });
            }
            catch (PublicBookingDisabledException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
        });

        api.MapGet("/clinics/{slug}/services", async (string slug, IPublicBookingService s, CancellationToken t) =>
        {
            try
            {
                var services = await s.GetServicesAsync(slug, t);
                return Results.Ok(services);
            }
            catch (PublicBookingNotFoundException ex)
            {
                return Results.NotFound(new { title = ex.Message });
            }
            catch (PublicBookingDisabledException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
        });

        api.MapGet("/clinics/{slug}/availability", async (
            string slug, Guid doctorId, DateOnly date, Guid? serviceId, IPublicBookingService s, CancellationToken t) =>
        {
            try
            {
                var slots = await s.GetAvailabilityAsync(slug, doctorId, date, serviceId, t);
                return Results.Ok(slots);
            }
            catch (PublicBookingNotFoundException ex)
            {
                return Results.NotFound(new { title = ex.Message });
            }
            catch (PublicBookingDisabledException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
        });

        api.MapPost("/clinics/{slug}/bookings", async (
            string slug, PublicBookingRequest request, IPublicBookingService s, ApplicationDbContext db,
            HttpContext context, ILoggerFactory loggerFactory, CancellationToken t) =>
        {
            try
            {
                var payload = request with { ClinicSlug = slug };
                var confirmation = await s.CreateBookingAsync(payload, t);
                var booking = await db.Appointments.IgnoreQueryFilters().AsNoTracking()
                    .SingleAsync(x => x.BookingReference == confirmation.BookingReference, t);
                await QueueAlertSafelyAsync(db, loggerFactory.CreateLogger(nameof(PublicBookingEndpoints)), booking.TenantId, "BookingCreated",
                    Permissions.AppointmentsView, "New online booking",
                    $"{confirmation.PatientName} booked an appointment on {confirmation.StartAt:yyyy-MM-dd HH:mm} UTC. Reference: {confirmation.BookingReference}.",
                    "Appointment", booking.Id, $"booking-created-staff:{booking.Id:N}", t);
                if (!string.IsNullOrWhiteSpace(payload.PatientEmail))
                {
                    var host = context.Request.Host.Host;
                    var baseHost = host.StartsWith("app.", StringComparison.OrdinalIgnoreCase) ? host[4..]
                        : host.StartsWith("admin.", StringComparison.OrdinalIgnoreCase) ? host[6..]
                        : host.StartsWith("book.", StringComparison.OrdinalIgnoreCase) ? host[5..] : host;
                    var local = baseHost is "localhost" or "127.0.0.1";
                    var publicHost = $"book.{(local ? "localhost" : baseHost)}";
                    var port = local && (host is "localhost" or "127.0.0.1") ? 8080 : context.Request.Host.Port;
                    var manageUrl = $"{context.Request.Scheme}://{publicHost}{(port is { } number ? $":{number}" : "")}/book/confirmation/{Uri.EscapeDataString(confirmation.BookingReference)}?manage={confirmation.ManagementToken}";
                    var zone = TimeZoneInfo.FindSystemTimeZoneById(confirmation.TimeZone);
                    var localStart = TimeZoneInfo.ConvertTime(confirmation.StartAt, zone);
                    await BookingEmailDispatcher.EnqueueAsync(db, booking.TenantId, booking.PatientId, booking.Id,
                        payload.PatientEmail, "BookingCreated", $"Appointment at {confirmation.ClinicName}",
                        $"Hello {confirmation.PatientName},\nYour appointment is booked for {localStart:yyyy-MM-dd HH:mm} ({confirmation.TimeZone}).\nReference: {confirmation.BookingReference}\nManage your booking: {manageUrl}",
                        $"booking-created:{booking.Id:N}", t);
                }
                return Results.Created($"/api/public/bookings/confirmation/{confirmation.BookingReference}", confirmation);
            }
            catch (PublicBookingNotFoundException ex)
            {
                return Results.NotFound(new { title = ex.Message });
            }
            catch (PublicBookingDisabledException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
            catch (PublicBookingConflictException ex)
            {
                return Results.Conflict(new { title = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { title = ex.Message });
            }
        });

        api.MapPost("/clinics/{slug}/inquiries", async (string slug,
            PublicBookingInquiryRequest request, IPublicBookingService service, ApplicationDbContext db,
            ILoggerFactory loggerFactory, CancellationToken token) =>
        {
            try
            {
                var id = await service.CreateInquiryAsync(slug, request, token);
                var inquiry = await db.BookingInquiries.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == id, token);
                await QueueAlertSafelyAsync(db, loggerFactory.CreateLogger(nameof(PublicBookingEndpoints)), inquiry.TenantId, "BookingInquiry",
                    Permissions.AppointmentsView, "New booking inquiry",
                    $"{inquiry.PatientName} requested a call back. Phone: {inquiry.Phone}.",
                    "BookingInquiry", id, $"booking-inquiry:{id:N}", token);
                return Results.Accepted($"/api/public/clinics/{slug}/inquiries/{id:D}", new { id });
            }
            catch (PublicBookingNotFoundException ex) { return Results.NotFound(new { title = ex.Message }); }
            catch (PublicBookingDisabledException ex) { return Results.BadRequest(new { title = ex.Message }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { title = ex.Message }); }
        });

        api.MapGet("/bookings/confirmation/{reference}", async (string reference, string? manage, ApplicationDbContext db, IPublicBookingService s, CancellationToken t) =>
        {
            var booking = string.IsNullOrWhiteSpace(manage) ? null : await FindManagedBookingAsync(db, manage, t);
            if (booking is null || !string.Equals(booking.BookingReference, reference, StringComparison.Ordinal))
                return Results.NotFound(new { title = "Open the private management link supplied when you booked, or contact the clinic." });
            var confirmation = await s.GetBookingByReferenceAsync(reference, t);
            return confirmation != null ? Results.Ok(confirmation) : Results.NotFound(new { title = "Booking confirmation not found." });
        });

        api.MapGet("/bookings/manage/{managementToken}", async (string managementToken,
            ApplicationDbContext db, IPublicBookingService service, CancellationToken token) =>
        {
            var booking = await FindManagedBookingAsync(db, managementToken, token);
            if (booking is null) return Results.NotFound();
            var confirmation = await service.GetBookingByReferenceAsync(booking.BookingReference!, token);
            return confirmation is null ? Results.NotFound() : Results.Ok(confirmation);
        });

        api.MapGet("/bookings/manage/{managementToken}/availability", async (string managementToken, DateOnly date,
            ApplicationDbContext db, IPublicBookingService service, CancellationToken token) =>
        {
            var booking = await FindManagedBookingAsync(db, managementToken, token);
            if (booking is null) return Results.NotFound();
            var slug = await db.Tenants.AsNoTracking().IgnoreQueryFilters()
                .Where(x => x.Id == booking.TenantId).Select(x => x.Slug).SingleAsync(token);
            try { return Results.Ok(await service.GetAvailabilityAsync(slug, booking.DoctorProfileId, date, booking.TreatmentCatalogItemId, token)); }
            catch (Exception ex) when (ex is PublicBookingNotFoundException or PublicBookingDisabledException)
            { return Results.Conflict(new { title = "Online rescheduling is unavailable." }); }
        });

        api.MapPost("/bookings/manage/{managementToken}/confirm", async (string managementToken,
            ApplicationDbContext db, IPublicBookingService service, CancellationToken token) =>
        {
            var booking = await FindManagedBookingAsync(db, managementToken, token);
            if (booking is null) return Results.NotFound();
            if (booking.Status != AppointmentStatus.Scheduled) return Results.Conflict(new { title = "Booking cannot be confirmed in its current state." });
            booking.Confirm(DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(token);
            return Results.Ok(await service.GetBookingByReferenceAsync(booking.BookingReference!, token));
        });

        api.MapPost("/bookings/manage/{managementToken}/cancel", async (string managementToken,
            CancelManagedBooking request, ApplicationDbContext db, IPublicBookingService service,
            ILoggerFactory loggerFactory, CancellationToken token) =>
        {
            var booking = await FindManagedBookingAsync(db, managementToken, token);
            if (booking is null) return Results.NotFound();
            if (booking.Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
                return Results.Conflict(new { title = "Booking cannot be cancelled in its current state." });
            var config = await db.TenantConfigurations.AsNoTracking().IgnoreQueryFilters()
                .SingleAsync(x => x.TenantId == booking.TenantId, token);
            if (booking.StartAt <= DateTimeOffset.UtcNow.AddHours(config.CancellationNoticeHours))
                return Results.Conflict(new { title = "Please contact the clinic to cancel this close to the appointment." });
            booking.Cancel(string.IsNullOrWhiteSpace(request.Reason) ? "Cancelled by patient" : request.Reason, DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(token);
            await QueueAlertSafelyAsync(db, loggerFactory.CreateLogger(nameof(PublicBookingEndpoints)), booking.TenantId, "BookingCancelled",
                Permissions.AppointmentsView, "Online booking cancelled",
                $"Appointment {booking.BookingReference} was cancelled by the patient.",
                "Appointment", booking.Id, $"booking-cancelled:{booking.Id:N}", token);
            return Results.Ok(await service.GetBookingByReferenceAsync(booking.BookingReference!, token));
        });

        api.MapPost("/bookings/manage/{managementToken}/reschedule", async (string managementToken,
            RescheduleManagedBooking request, ApplicationDbContext db, IPublicBookingService service,
            ILoggerFactory loggerFactory, CancellationToken token) =>
        {
            var booking = await FindManagedBookingAsync(db, managementToken, token);
            if (booking is null) return Results.NotFound();
            if (booking.Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
                return Results.Conflict(new { title = "Booking cannot be rescheduled in its current state." });
            var tenant = await db.Tenants.AsNoTracking().IgnoreQueryFilters()
                .SingleAsync(x => x.Id == booking.TenantId, token);
            var config = await db.TenantConfigurations.AsNoTracking().IgnoreQueryFilters()
                .SingleAsync(x => x.TenantId == booking.TenantId, token);
            if (booking.StartAt <= DateTimeOffset.UtcNow.AddHours(config.CancellationNoticeHours))
                return Results.Conflict(new { title = "Please contact the clinic to change this close to the appointment." });
            var zone = TimeZoneInfo.FindSystemTimeZoneById(config.TimeZone);
            var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(request.StartAt, zone).DateTime);
            IReadOnlyCollection<PublicAvailabilitySlotDto> slots;
            try { slots = await service.GetAvailabilityAsync(tenant.Slug, booking.DoctorProfileId, localDate, booking.TreatmentCatalogItemId, token); }
            catch (Exception ex) when (ex is PublicBookingNotFoundException or PublicBookingDisabledException)
            { return Results.Conflict(new { title = "Online rescheduling is unavailable. Please call the clinic." }); }
            if (!slots.Any(x => x.StartAt == request.StartAt && (x.EndAt - x.StartAt).TotalMinutes == booking.DurationMinutes))
                return Results.Conflict(new { title = "That time is unavailable. Choose another slot." });
            booking.Reschedule(request.StartAt, booking.DurationMinutes, DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(token);
            await QueueAlertSafelyAsync(db, loggerFactory.CreateLogger(nameof(PublicBookingEndpoints)), booking.TenantId, "BookingRescheduled",
                Permissions.AppointmentsView, "Online booking rescheduled",
                $"Appointment {booking.BookingReference} was moved to {booking.StartAt:yyyy-MM-dd HH:mm} UTC.",
                "Appointment", booking.Id, $"booking-rescheduled:{booking.Id:N}:{booking.StartAt.ToUnixTimeSeconds()}", token);
            return Results.Ok(await service.GetBookingByReferenceAsync(booking.BookingReference!, token));
        });

        return endpoints;
    }

    private static async Task<Appointment?> FindManagedBookingAsync(ApplicationDbContext db, string value, CancellationToken token)
    {
        if (value.Length != 48 || !value.All(Uri.IsHexDigit)) return null;
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.ToLowerInvariant())));
        return await db.Appointments.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.PublicManagementTokenHash == hash, token);
    }

    private sealed record CancelManagedBooking(string? Reason);
    private sealed record RescheduleManagedBooking(DateTimeOffset StartAt);
    private sealed record VisitInput(string? Source);
    private static string NormalizeSource(string? source) => source?.Trim().ToLowerInvariant() switch
    {
        "qr" => "qr", "google" => "google", "social" => "social", _ => "direct"
    };
}
