using System.Text;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Application.Identity;
using DentalClinic.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace DentalClinic.Api.Extensions;

internal static class AuthenticationExtensions
{
    public static IServiceCollection AddApiAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var issuer = configuration["Authentication:Jwt:Issuer"]
            ?? throw new InvalidOperationException("Authentication:Jwt:Issuer is required.");
        var audience = configuration["Authentication:Jwt:Audience"]
            ?? throw new InvalidOperationException("Authentication:Jwt:Audience is required.");
        var signingKey = configuration["Authentication:Jwt:SigningKey"]
            ?? throw new InvalidOperationException("Authentication:Jwt:SigningKey is required.");

        if (signingKey.Length < 32)
        {
            throw new InvalidOperationException("Authentication:Jwt:SigningKey must be at least 32 characters.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    ValidAudience = audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                    NameClaimType = "name",
                    RoleClaimType = "role",
                    ClockSkew = TimeSpan.FromMinutes(1)
                };
            });

        return services;
    }

    public static IServiceCollection AddApiAuthorization(this IServiceCollection services)
    {
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddAuthorization(options =>
        {
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
