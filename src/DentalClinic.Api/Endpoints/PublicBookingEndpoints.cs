using DentalClinic.Application.PublicBooking;
using QRCoder;

namespace DentalClinic.Api.Endpoints;

internal static class PublicBookingEndpoints
{
    public static IEndpointRouteBuilder MapPublicBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/public").AllowAnonymous();

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
                var url = $"{context.Request.Scheme}://{publicHost}{(port is { } number ? $":{number}" : "")}/book/{Uri.EscapeDataString(clinic.Slug)}";
                using var data = QRCodeGenerator.GenerateQrCode(url, QRCodeGenerator.ECCLevel.Q);
                using var qr = new SvgQRCode(data);
                return Results.Content(qr.GetGraphic(6), "image/svg+xml");
            }
            catch (PublicBookingNotFoundException) { return Results.NotFound(); }
            catch (PublicBookingDisabledException) { return Results.NotFound(); }
        }).RequireRateLimiting("public-read");

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
        }).RequireRateLimiting("public-read");

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
        }).RequireRateLimiting("public-read");

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
        }).RequireRateLimiting("public-read");

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
        }).RequireRateLimiting("public-read");

        api.MapPost("/clinics/{slug}/bookings", async (
            string slug, PublicBookingRequest request, IPublicBookingService s, CancellationToken t) =>
        {
            try
            {
                var payload = request with { ClinicSlug = slug };
                var confirmation = await s.CreateBookingAsync(payload, t);
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
        }).RequireRateLimiting("public-booking");

        api.MapPost("/clinics/{slug}/inquiries", async (string slug,
            PublicBookingInquiryRequest request, IPublicBookingService service, CancellationToken token) =>
        {
            try
            {
                var id = await service.CreateInquiryAsync(slug, request, token);
                return Results.Accepted($"/api/public/clinics/{slug}/inquiries/{id:D}", new { id });
            }
            catch (PublicBookingNotFoundException ex) { return Results.NotFound(new { title = ex.Message }); }
            catch (PublicBookingDisabledException ex) { return Results.BadRequest(new { title = ex.Message }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { title = ex.Message }); }
        }).RequireRateLimiting("public-booking");

        api.MapGet("/bookings/confirmation/{reference}", async (string reference, IPublicBookingService s, CancellationToken t) =>
        {
            var confirmation = await s.GetBookingByReferenceAsync(reference, t);
            return confirmation != null ? Results.Ok(confirmation) : Results.NotFound(new { title = "Booking confirmation not found." });
        }).RequireRateLimiting("public-read");

        return endpoints;
    }
}
