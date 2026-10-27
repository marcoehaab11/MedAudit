using IAuthenticationService = DentalClinic.Application.Identity.IAuthenticationService;
using System.Security.Claims;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Identity;

public sealed class ClinicSessionService(ApplicationDbContext db, IIdentityStore identities, IAuthenticationService authentication)
{
    public async Task SignInAsync(HttpContext context, LoginResult result)
    {
        using var databaseAccess = db.Access.Authentication();
        var member = await db.ClinicUsers.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(x => x.Id == result.UserId && x.TenantId == result.TenantId, context.RequestAborted);
        var account = await db.Users.AsNoTracking().SingleAsync(x => x.Id == member.IdentityUserId, context.RequestAborted);
        if (string.IsNullOrEmpty(account.SecurityStamp) || account.IsPlatformAdmin)
            throw new InvalidOperationException("The account cannot start a clinic session.");
        // Switching clinics replaces, rather than leaves behind, the old usable session.
        await context.SignOutAsync(VerifiedSessionEvents.ClinicScheme);
        var claims = new List<Claim>
        {
            new("sub", member.Id.ToString("D")), new(AuthConstants.TenantIdClaim, member.TenantId.ToString("D")),
            new(ClaimTypes.Name, member.DisplayName), new(VerifiedSessionEvents.IdentityClaim, account.Id.ToString("D")),
            new(VerifiedSessionEvents.StampClaim, account.SecurityStamp)
        };
        await context.SignInAsync(VerifiedSessionEvents.ClinicScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, VerifiedSessionEvents.ClinicScheme)),
            new AuthenticationProperties { IsPersistent = false, ExpiresUtc = result.ExpiresAt, AllowRefresh = false });
    }

    public async Task<LoginResult> ReadAsync(HttpContext context)
    {
        var memberId = Guid.Parse(context.User.FindFirstValue("sub")!);
        var tenantId = Guid.Parse(context.User.FindFirstValue(AuthConstants.TenantIdClaim)!);
        var member = await db.ClinicUsers.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(x => x.Id == memberId && x.TenantId == tenantId, context.RequestAborted);
        var tenantName = await db.Tenants.AsNoTracking().Where(x => x.Id == tenantId).Select(x => x.Name).SingleAsync(context.RequestAborted);
        var ticket = await context.AuthenticateAsync(VerifiedSessionEvents.ClinicScheme);
        return new LoginResult(ticket.Properties!.ExpiresUtc!.Value, memberId, member.DisplayName,
            await identities.GetRoleNamesForUserAsync(tenantId, memberId, context.RequestAborted),
            await identities.GetEffectivePermissionsForUserAsync(tenantId, memberId, context.RequestAborted), tenantId, tenantName,
            await authentication.GetClinicsAsync(tenantId, memberId, context.RequestAborted));
    }
}
