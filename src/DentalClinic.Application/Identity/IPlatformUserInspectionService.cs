using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Identity;

public interface IPlatformUserInspectionService
{
    Task<PagedResult<UserListItem>> SearchAsync(Guid tenantId, UserSearchQuery query, CancellationToken cancellationToken);
}
