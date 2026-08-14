using System.Security.Claims;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.UnitTests;

public sealed class PlatformAccessTests
{
    [Fact]
    public void DoctorCannotAccessPlatformScope()
    {
        var principal = Principal(AuthConstants.DoctorRole, Guid.NewGuid());

        Assert.False(PlatformAccess.IsPlatformAdmin(principal));
    }

    [Fact]
    public void TenantScopedPlatformAdminCannotAccessPlatformScope()
    {
        var principal = Principal(AuthConstants.PlatformAdminRole, Guid.NewGuid());

        Assert.False(PlatformAccess.IsPlatformAdmin(principal));
    }

    [Fact]
    public void PlatformAdminWithoutTenantCanAccessPlatformScope()
    {
        var principal = Principal(AuthConstants.PlatformAdminRole, null);

        Assert.True(PlatformAccess.IsPlatformAdmin(principal));
    }

    private static ClaimsPrincipal Principal(string role, Guid? tenantId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new(ClaimTypes.Role, role)
        };
        if (tenantId.HasValue)
        {
            claims.Add(new Claim(AuthConstants.TenantIdClaim, tenantId.Value.ToString()));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test", ClaimTypes.Name, ClaimTypes.Role));
    }
}
