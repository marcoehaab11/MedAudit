using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class UserPermissionProfile : TenantOwnedEntity
{
    private UserPermissionProfile() { }

    public UserPermissionProfile(Guid tenantId, Guid userId, IEnumerable<string> permissions)
    {
        if (tenantId == Guid.Empty || userId == Guid.Empty) throw new ArgumentException("Tenant and user IDs are required.");
        TenantId = tenantId;
        UserId = userId;
        SetPermissions(permissions);
    }

    public Guid UserId { get; private set; }
    public string[] Permissions { get; private set; } = [];

    public void SetPermissions(IEnumerable<string> permissions) => Permissions =
        permissions.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
}
