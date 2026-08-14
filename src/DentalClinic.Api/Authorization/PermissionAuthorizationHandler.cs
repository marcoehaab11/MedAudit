using DentalClinic.Application.Identity;
using Microsoft.AspNetCore.Authorization;

namespace DentalClinic.Api.Authorization;

internal sealed class PermissionAuthorizationHandler(IPermissionService permissions)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var cancellationToken = context.Resource is HttpContext httpContext
            ? httpContext.RequestAborted
            : CancellationToken.None;
        if (await permissions.HasPermissionAsync(requirement.Permission, cancellationToken))
        {
            context.Succeed(requirement);
        }
    }
}
