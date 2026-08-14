using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class UserRoleAssignment : TenantOwnedEntity
{
    private UserRoleAssignment() { }

    public UserRoleAssignment(Guid tenantId, Guid userId, Guid roleId, DateTimeOffset assignedAt)
    {
        if (tenantId == Guid.Empty || userId == Guid.Empty || roleId == Guid.Empty)
        {
            throw new ArgumentException("Tenant, user, and role IDs are required.");
        }

        TenantId = tenantId;
        UserId = userId;
        RoleId = roleId;
        AssignedAt = assignedAt;
    }

    public Guid UserId { get; private set; }
    public Guid RoleId { get; private set; }
    public DateTimeOffset AssignedAt { get; private set; }
}
