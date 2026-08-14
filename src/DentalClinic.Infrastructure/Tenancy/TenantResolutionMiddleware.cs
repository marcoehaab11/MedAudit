using System.Security.Claims;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Http;

namespace DentalClinic.Infrastructure.Tenancy;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, CurrentTenant currentTenant)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var value = context.User.FindFirstValue(AuthConstants.TenantIdClaim);
            if (value is not null)
            {
                if (!Guid.TryParse(value, out var tenantId) || tenantId == Guid.Empty)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "The authenticated tenant claim is invalid.",
                        traceId = context.TraceIdentifier
                    }, context.RequestAborted);
                    return;
                }

                currentTenant.Set(tenantId);
            }
        }

        await next(context);
    }
}
