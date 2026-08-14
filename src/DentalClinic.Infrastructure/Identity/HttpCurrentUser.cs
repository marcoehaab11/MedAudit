using System.Security.Claims;
using DentalClinic.Application.Identity;
using Microsoft.AspNetCore.Http;

namespace DentalClinic.Infrastructure.Identity;

internal sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId => Guid.TryParse(
        accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        accessor.HttpContext?.User.FindFirstValue("sub"),
        out var userId) ? userId : null;
}
