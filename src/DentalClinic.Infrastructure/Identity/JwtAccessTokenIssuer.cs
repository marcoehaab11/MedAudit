using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DentalClinic.Application.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace DentalClinic.Infrastructure.Identity;

public sealed class JwtAccessTokenIssuer(IConfiguration configuration) : IAccessTokenIssuer
{
    public (string Token, DateTimeOffset ExpiresAt) Issue(
        Guid userId,
        Guid tenantId,
        string displayName,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions)
    {
        var issuer = configuration["Authentication:Jwt:Issuer"] ?? "DentalClinic";
        var audience = configuration["Authentication:Jwt:Audience"] ?? "DentalClinic";
        var signingKey = configuration["Authentication:Jwt:SigningKey"]
            ?? configuration["Authentication__Jwt__SigningKey"]
            ?? "SuperSecretDefaultSigningKeyForDockerBuild123!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var expiresAt = DateTimeOffset.UtcNow.AddHours(12);
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
}
