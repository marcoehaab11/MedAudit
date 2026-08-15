using DentalClinic.Application.PublicBooking;

namespace DentalClinic.Api.Endpoints;

internal static class PublicBookingEndpoints
{
    public static IEndpointRouteBuilder MapPublicBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/public").AllowAnonymous();

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

        api.MapGet("/bookings/confirmation/{reference}", async (string reference, IPublicBookingService s, CancellationToken t) =>
        {
            var confirmation = await s.GetBookingByReferenceAsync(reference, t);
            return confirmation != null ? Results.Ok(confirmation) : Results.NotFound(new { title = "Booking confirmation not found." });
        }).RequireRateLimiting("public-read");

        return endpoints;
    }
}
