using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using DentalClinic.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static class OnboardingEndpoints
{
    public static IEndpointRouteBuilder MapOnboardingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/public/clinics").AllowAnonymous()
            .AddEndpointFilter(new DatabaseAccessFilter("booking"));
        group.MapPost("/register", async (RegisterClinicInput input, ClinicOnboardingService service, CancellationToken token) =>
        {
            await service.RegisterAsync(input, token);
            return Results.Accepted(value: new { message = "If this email can be registered, a confirmation email will be sent. Existing users can sign in or reset their password." });
        });
        group.MapPost("/confirm", async (ConfirmInput input, ClinicOnboardingService service, PlatformMailService mail, CancellationToken token) =>
        {
            await service.ConfirmAsync(input.Id, input.Token, token);
            return Results.Ok(new { confirmed = true, loginUrl = await mail.AppUrlAsync(false, token) + "/login" });
        });
        group.MapPost("/resend", async (EmailInput input, ClinicOnboardingService service, CancellationToken token) =>
        {
            await service.ResendAsync(input.Email, token);
            return Results.Accepted(value: new { message = "A confirmation email will be sent if needed." });
        });
        group.MapGet("/customers", async (ApplicationDbContext db, CancellationToken token) =>
            await db.Tenants.AsNoTracking().Where(x => x.ParentClinicId == null && x.ShowcaseConsent && x.ShowcasePublished && x.Status == TenantStatus.Active && x.SubscriptionExpiresAt > DateTimeOffset.UtcNow)
                .OrderBy(x => x.ShowcaseOrder).ThenBy(x => x.Name).Select(x => new { x.Name, x.LogoReference, x.City }).Take(60).ToArrayAsync(token));
        group.MapGet("/logos/{id:guid}", async (Guid id, ApplicationDbContext db, HttpContext context, CancellationToken token) =>
        {
            var logo = await db.ClinicRegistrations.AsNoTracking().Where(x => x.Id == id && x.VerifiedAt != null && x.TenantId != null)
                .Select(x => new { x.Logo, x.LogoContentType }).SingleOrDefaultAsync(token);
            if (logo?.Logo is null || logo.LogoContentType is null) return Results.NotFound();
            context.Response.Headers.XContentTypeOptions = "nosniff";
            context.Response.Headers.CacheControl = "public, max-age=86400";
            return Results.File(logo.Logo, logo.LogoContentType);
        });
        endpoints.MapPost("/api/auth/forgot-password", async (EmailInput input, ClinicOnboardingService service, CancellationToken token) =>
        {
            await service.ForgotPasswordAsync(input.Email, token);
            return Results.Accepted(value: new { message = "If the account exists, reset instructions will be sent." });
        }).AllowAnonymous();
        endpoints.MapPost("/api/auth/reset-password", async (ResetInput input, ClinicOnboardingService service) =>
        {
            await service.ResetPasswordAsync(input.Email, input.Token, input.Password, input.ConfirmPassword);
            return Results.Ok(new { reset = true });
        }).AllowAnonymous();
        return endpoints;
    }

    private sealed record EmailInput(string Email);
    private sealed record ConfirmInput(Guid Id, string Token);
    private sealed record ResetInput(string Email, string Token, string Password, string ConfirmPassword);
}
