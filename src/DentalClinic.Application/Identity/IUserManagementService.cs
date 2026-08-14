using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Identity;

public interface IUserManagementService
{
    Task<PagedResult<UserListItem>> SearchUsersAsync(UserSearchQuery query, CancellationToken cancellationToken);
    Task<UserDetails?> GetUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<Guid> InviteUserAsync(InviteUserCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateUserAsync(UpdateUserCommand command, CancellationToken cancellationToken);
    Task<bool> SetUserActiveAsync(Guid userId, bool active, CancellationToken cancellationToken);
    Task<bool> AssignRolesAsync(AssignUserRolesCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<RoleSummary>> GetRolesAsync(CancellationToken cancellationToken);
    Task<RoleDetails?> GetRoleAsync(Guid roleId, CancellationToken cancellationToken);
    Task<Guid> CreateRoleAsync(CreateRoleCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateRoleAsync(UpdateRoleCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateRolePermissionsAsync(UpdateRolePermissionsCommand command, CancellationToken cancellationToken);
}
