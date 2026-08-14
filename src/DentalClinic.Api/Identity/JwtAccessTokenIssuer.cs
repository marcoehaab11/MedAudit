using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using Microsoft.IdentityModel.Tokens;

namespace DentalClinic.Api.Identity;

internal sealed class JwtAccessTokenIssuer(IConfiguration configuration) : IAccessTokenIssuer
{
    public (string Token, DateTimeOffset ExpiresAt) Issue(
        Guid userId,
        Guid tenantId,
        string displayName,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions)
    {
        var issuer = Required("Authentication:Jwt:Issuer");
        var audience = Required("Authentication:Jwt:Audience");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Required("Authentication:Jwt:SigningKey")));
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString("D")),
            new("name", displayName),
            new(AuthConstants.TenantIdClaim, tenantId.ToString("D"))
        };
        claims.AddRange(roles.Select(role => new Claim("role", role)));
        claims.AddRange(permissions.Select(permission => new Claim("permission", permission)));
        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            DateTime.UtcNow,
            expiresAt.UtcDateTime,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private string Required(string key) => configuration[key]
        ?? throw new InvalidOperationException($"{key} is required.");
}
