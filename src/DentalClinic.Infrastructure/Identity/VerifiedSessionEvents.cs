using System.Security.Claims;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Identity;

public sealed class VerifiedSessionEvents(ApplicationDbContext db, IIdentityStore identities) : CookieAuthenticationEvents
{
    public const string ClinicScheme = "ClinicSession";
    public const string IdentityClaim = "identity_user_id";
    public const string StampClaim = "session_security_stamp";

    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        using var databaseAccess = db.Access.Authentication();
        var principal = context.Principal;
        var identityValue = principal?.FindFirstValue(IdentityClaim);
        if (!Guid.TryParse(identityValue, out var identityId)) { await RejectAsync(context); return; }
        var account = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == identityId, context.HttpContext.RequestAborted);
        if (account is null || string.IsNullOrEmpty(account.SecurityStamp) ||
            !string.Equals(account.SecurityStamp, principal?.FindFirstValue(StampClaim), StringComparison.Ordinal) ||
            account.LockoutEnd > DateTimeOffset.UtcNow)
        { await RejectAsync(context); return; }

        if (context.Scheme.Name == IdentityConstants.ApplicationScheme)
        {
            if (!account.IsPlatformAdmin || account.TenantId is not null) { await RejectAsync(context); return; }
            context.ReplacePrincipal(new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, account.Id.ToString("D")),
                 new Claim(ClaimTypes.Name, account.UserName ?? "Administrator"),
                 new Claim(ClaimTypes.Role, AuthConstants.PlatformAdminRole),
                 new Claim(IdentityClaim, account.Id.ToString("D")), new Claim(StampClaim, account.SecurityStamp)], context.Scheme.Name)));
            return;
        }

        if (account.IsPlatformAdmin || !Guid.TryParse(principal?.FindFirstValue("sub"), out var memberId) ||
            !Guid.TryParse(principal?.FindFirstValue(AuthConstants.TenantIdClaim), out var tenantId))
        { await RejectAsync(context); return; }
        var now = DateTimeOffset.UtcNow;
        var member = await (from user in db.ClinicUsers.IgnoreQueryFilters().AsNoTracking()
                            join tenant in db.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
                            join clinic in db.Tenants.AsNoTracking() on (tenant.ParentClinicId ?? tenant.Id) equals clinic.Id
                            where user.Id == memberId && user.TenantId == tenantId && user.IdentityUserId == identityId &&
                                user.Status == UserStatus.Active && tenant.Status == TenantStatus.Active && clinic.Status == TenantStatus.Active &&
                                clinic.SubscriptionStartsAt <= now && clinic.SubscriptionExpiresAt > now
                            select user).SingleOrDefaultAsync(context.HttpContext.RequestAborted);
        if (member is null) { await RejectAsync(context); return; }
        var roles = await identities.GetRoleNamesForUserAsync(tenantId, memberId, context.HttpContext.RequestAborted);
        var claims = new List<Claim>
        {
            new("sub", memberId.ToString("D")), new(ClaimTypes.Name, member.DisplayName),
            new(AuthConstants.TenantIdClaim, tenantId.ToString("D")), new(IdentityClaim, identityId.ToString("D")),
            new(StampClaim, account.SecurityStamp)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        context.ReplacePrincipal(new ClaimsPrincipal(new ClaimsIdentity(claims, context.Scheme.Name)));
    }

    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    {
        if (context.Scheme.Name == IdentityConstants.ApplicationScheme) context.Response.Redirect(context.RedirectUri);
        else context.Response.StatusCode = 401;
        return Task.CompletedTask;
    }

    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = 403;
        return Task.CompletedTask;
    }

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(context.Scheme.Name);
    }
}
