using System.Security.Claims;

namespace DentalClinic.Infrastructure.Identity;

public static class PlatformAccess
{
    public static bool IsPlatformAdmin(ClaimsPrincipal user) =>
        user.IsInRole(AuthConstants.PlatformAdminRole) &&
        !user.HasClaim(claim => claim.Type == AuthConstants.TenantIdClaim);
}
