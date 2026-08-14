using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Identity;

internal sealed class PlatformUserInspectionService(
    IIdentityStore store,
    IPlatformAccessContext access) : IPlatformUserInspectionService
{
    public Task<PagedResult<UserListItem>> SearchAsync(
        Guid tenantId,
        UserSearchQuery query,
        CancellationToken cancellationToken)
    {
        if (!access.IsPlatformAdmin || tenantId == Guid.Empty)
            throw new ForbiddenAccessException("Platform administrator access with an explicit tenant is required.");
        return store.SearchUsersForTenantAsync(tenantId, query with
        {
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, 100)
        }, cancellationToken);
    }
}
