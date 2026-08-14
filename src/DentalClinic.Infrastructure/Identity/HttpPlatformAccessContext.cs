using System.Security.Claims;
using DentalClinic.Application.Platform;
using Microsoft.AspNetCore.Http;

namespace DentalClinic.Infrastructure.Identity;

internal sealed class HttpPlatformAccessContext(IHttpContextAccessor accessor) : IPlatformAccessContext
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;
    public bool IsPlatformAdmin => User is not null && PlatformAccess.IsPlatformAdmin(User);
    public Guid? UserId => Guid.TryParse(
        User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub"), out var id) ? id : null;
    public string? CorrelationId => accessor.HttpContext?.TraceIdentifier;
}
