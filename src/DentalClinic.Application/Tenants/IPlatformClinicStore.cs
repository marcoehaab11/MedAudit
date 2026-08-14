using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public interface IPlatformClinicStore
{
    Task<IPlatformTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    Task<PagedResult<ClinicListItem>> SearchAsync(ClinicSearchQuery query, CancellationToken cancellationToken);
    Task<ClinicDetails?> GetDetailsAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<bool> SlugExistsAsync(string slug, Guid? excludingTenantId, CancellationToken cancellationToken);
    Task<AdminInvitation?> FindInvitationByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task<TenantRole?> FindRoleByNameAsync(Guid tenantId, string normalizedName, CancellationToken cancellationToken);
    void AddTenant(Tenant tenant);
    void AddTenantConfiguration(TenantConfiguration configuration);
    void AddInvitation(AdminInvitation invitation);
    void AddAudit(PlatformAuditLog audit);
    void AddClinicUser(ClinicUser user);
    void AddTenantRole(TenantRole role);
    void AddRolePermission(RolePermissionGrant permission);
    void AddUserRole(UserRoleAssignment assignment);
    Task SavePlatformChangesAsync(Guid tenantId, CancellationToken cancellationToken);
}
