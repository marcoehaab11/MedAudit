using System.Security.Cryptography;
using System.Text;
using DentalClinic.Infrastructure.Persistence;

namespace DentalClinic.Api.Endpoints;

internal sealed class DatabaseAccessFilter(string purpose) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var access = context.HttpContext.RequestServices.GetRequiredService<DatabaseAccessScope>();
        var request = context.HttpContext.Request;
        var slug = request.RouteValues["slug"]?.ToString() ?? "";
        var secret = request.RouteValues["managementToken"]?.ToString() ?? request.Query["manage"].ToString();
        var hash = string.IsNullOrWhiteSpace(secret) ? "" : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
        using var scope = purpose switch
        {
            "identity" => access.Authentication(),
            "branches" => access.BranchAdministration(),
            _ => access.PublicBooking(slug, hash)
        };
        return await next(context);
    }
}
