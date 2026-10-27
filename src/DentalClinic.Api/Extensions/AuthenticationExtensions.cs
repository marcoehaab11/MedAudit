using DentalClinic.Infrastructure.Identity;
using DentalClinic.Application.Identity;
using DentalClinic.Api.Authorization;
using Microsoft.AspNetCore.Authorization;

namespace DentalClinic.Api.Extensions;

internal static class AuthenticationExtensions
{
    public static IServiceCollection AddApiAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddAuthentication(VerifiedSessionEvents.ClinicScheme)
            .AddCookie(VerifiedSessionEvents.ClinicScheme, options =>
            {
                options.Cookie.Name = "Planora.Clinic.Session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(12);
                options.SlidingExpiration = false;
                options.EventsType = typeof(VerifiedSessionEvents);
            });
        services.AddVerifiedSessions(VerifiedSessionEvents.ClinicScheme);
        services.AddScoped<ClinicSessionService>();

        return services;
    }

    public static IServiceCollection AddApiAuthorization(this IServiceCollection services)
    {
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().RequireClaim(AuthConstants.TenantIdClaim).Build();
            options.AddPolicy(AuthConstants.TenantMemberPolicy, policy =>
                policy.RequireAuthenticatedUser().RequireClaim(AuthConstants.TenantIdClaim));
            options.AddPolicy(AuthConstants.PlatformAdminPolicy, policy =>
                policy.RequireAuthenticatedUser()
                    .RequireAssertion(context => PlatformAccess.IsPlatformAdmin(context.User)));
            foreach (var permission in Permissions.All)
            {
                options.AddPolicy(permission, policy =>
                    policy.RequireAuthenticatedUser()
                        .RequireClaim(AuthConstants.TenantIdClaim)
                        .AddRequirements(new PermissionRequirement(permission)));
            }
        });
        return services;
    }
}
