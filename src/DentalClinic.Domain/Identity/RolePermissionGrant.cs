using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class RolePermissionGrant : TenantOwnedEntity
{
    private RolePermissionGrant() { }

    public RolePermissionGrant(Guid tenantId, Guid roleId, string permission)
    {
        if (tenantId == Guid.Empty || roleId == Guid.Empty)
        {
            throw new ArgumentException("Tenant and role IDs are required.");
        }

        TenantId = tenantId;
        RoleId = roleId;
        Permission = string.IsNullOrWhiteSpace(permission)
            ? throw new ArgumentException("Permission is required.", nameof(permission))
            : permission.Trim();
    }

    public Guid RoleId { get; private set; }
    public string Permission { get; private set; } = string.Empty;
}
