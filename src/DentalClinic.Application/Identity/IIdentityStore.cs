using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Identity;

public interface IIdentityStore
{
    Task<IIdentityTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    Task<PagedResult<UserListItem>> SearchUsersAsync(UserSearchQuery query, CancellationToken cancellationToken);
    Task<PagedResult<UserListItem>> SearchUsersForTenantAsync(Guid tenantId, UserSearchQuery query, CancellationToken cancellationToken);
    Task<UserDetails?> GetUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<ClinicUser?> FindUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<TenantRole>> GetRolesAsync(CancellationToken cancellationToken);
    Task<RoleDetails?> GetRoleDetailsAsync(Guid roleId, CancellationToken cancellationToken);
    Task<TenantRole?> FindRoleAsync(Guid roleId, CancellationToken cancellationToken);
    Task<TenantRole?> FindRoleByNameAsync(Guid tenantId, string normalizedName, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<TenantRole>> FindRolesAsync(IReadOnlyCollection<Guid> roleIds, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<string>> GetEffectivePermissionsAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<string>> GetRolePermissionsAsync(Guid roleId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<RolePermissionGrant>> GetRolePermissionEntitiesAsync(Guid roleId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<UserRoleAssignment>> GetUserRoleAssignmentsAsync(Guid userId, CancellationToken cancellationToken);
    Task<InvitationAccount?> FindInvitationAsync(string tokenHash, CancellationToken cancellationToken);
    Task<AdminInvitation?> FindPendingInvitationForUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<LoginAccount?> FindLoginAccountAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<string>> GetRoleNamesForUserAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<string>> GetEffectivePermissionsForUserAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken);
    void AddUser(ClinicUser user);
    void AddRole(TenantRole role);
    void AddRolePermission(RolePermissionGrant permission);
    void AddUserRole(UserRoleAssignment assignment);
    void AddInvitation(AdminInvitation invitation);
    void AddAudit(PlatformAuditLog audit);
    void RemoveRolePermission(RolePermissionGrant permission);
    void RemoveUserRole(UserRoleAssignment assignment);
    Task SaveChangesAsync(CancellationToken cancellationToken);
    Task SaveForTenantAsync(Guid tenantId, CancellationToken cancellationToken);
}
