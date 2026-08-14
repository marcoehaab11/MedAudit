using System.Net.Mail;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Identity;

internal sealed class UserManagementService(
    IIdentityStore store,
    IIdentityCredentialService credentials,
    IPermissionService permissions,
    ICurrentTenant currentTenant,
    ICurrentUser currentUser,
    IInvitationTokenGenerator tokenGenerator,
    IClinicInvitationNotifier notifier,
    ISystemClock clock) : IUserManagementService
{
    private static readonly TimeSpan InvitationLifetime = TimeSpan.FromHours(48);

    public async Task<PagedResult<UserListItem>> SearchUsersAsync(
        UserSearchQuery query,
        CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersView, cancellationToken);
        return await store.SearchUsersAsync(query with
        {
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, 100)
        }, cancellationToken);
    }

    public async Task<UserDetails?> GetUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersView, cancellationToken);
        return await store.GetUserAsync(userId, cancellationToken);
    }

    public async Task<Guid> InviteUserAsync(InviteUserCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersCreate, cancellationToken);
        await permissions.EnsurePermissionAsync(Permissions.UsersManageRoles, cancellationToken);
        ValidateInvite(command);

        var tenantId = currentTenant.RequireTenantId();
        var normalizedEmail = command.Email.Trim().ToUpperInvariant();
        if (await store.EmailExistsAsync(normalizedEmail, cancellationToken))
        {
            throw Validation("Email", "The invitation could not be created for this email.");
        }

        var roles = await ValidateAssignableRolesAsync(command.RoleIds, cancellationToken);
        var now = clock.UtcNow;
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var userId = await credentials.CreateInvitedUserAsync(
            tenantId, command.Email.Trim().ToLowerInvariant(), cancellationToken);
        var user = new ClinicUser(userId, tenantId, command.DisplayName, command.Phone, now);
        store.AddUser(user);
        foreach (var role in roles)
        {
            store.AddUserRole(new UserRoleAssignment(tenantId, userId, role.Id, now));
            AddAudit(PlatformAuditAction.RoleAssigned, nameof(TenantRole), role.Id, now);
        }

        var token = tokenGenerator.Generate();
        var invitation = new AdminInvitation(
            tenantId,
            userId,
            command.Email,
            roles[0].Name,
            InvitationTokenHasher.Hash(token),
            now.Add(InvitationLifetime),
            now);
        store.AddInvitation(invitation);
        AddAudit(PlatformAuditAction.UserInvited, nameof(ClinicUser), userId, now);
        await store.SaveChangesAsync(cancellationToken);
        await notifier.SendAsync(
            invitation.Id,
            invitation.Email,
            token,
            invitation.ExpiresAt,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return userId;
    }

    public async Task<bool> UpdateUserAsync(UpdateUserCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersEdit, cancellationToken);
        if (string.IsNullOrWhiteSpace(command.DisplayName) || command.DisplayName.Trim().Length > 200)
        {
            throw Validation("DisplayName", "Display name is required and cannot exceed 200 characters.");
        }

        var user = await store.FindUserAsync(command.Id, cancellationToken);
        if (user is null) return false;
        user.Update(command.DisplayName, command.Phone, clock.UtcNow);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SetUserActiveAsync(
        Guid userId,
        bool active,
        CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(
            active ? Permissions.UsersActivate : Permissions.UsersDeactivate,
            cancellationToken);
        EnsureNotSelf(userId);
        var user = await store.FindUserAsync(userId, cancellationToken);
        if (user is null) return false;

        var now = clock.UtcNow;
        if (active)
        {
            user.Activate(now);
            AddAudit(PlatformAuditAction.UserActivated, nameof(ClinicUser), user.Id, now);
        }
        else if (user.Status == UserStatus.Invited)
        {
            var invitation = await store.FindPendingInvitationForUserAsync(user.Id, cancellationToken);
            invitation?.Cancel();
            user.CancelInvitation(now);
            AddAudit(PlatformAuditAction.UserDeactivated, nameof(ClinicUser), user.Id, now);
        }
        else
        {
            user.Deactivate(now);
            AddAudit(PlatformAuditAction.UserDeactivated, nameof(ClinicUser), user.Id, now);
        }

        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> AssignRolesAsync(
        AssignUserRolesCommand command,
        CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersManageRoles, cancellationToken);
        EnsureNotSelf(command.UserId);
        if (await store.FindUserAsync(command.UserId, cancellationToken) is null) return false;
        var roles = await ValidateAssignableRolesAsync(command.RoleIds, cancellationToken);
        var existing = await store.GetUserRoleAssignmentsAsync(command.UserId, cancellationToken);
        var selected = roles.Select(x => x.Id).ToHashSet();
        var now = clock.UtcNow;

        foreach (var assignment in existing.Where(x => !selected.Contains(x.RoleId)))
        {
            store.RemoveUserRole(assignment);
            AddAudit(PlatformAuditAction.RoleRemoved, nameof(TenantRole), assignment.RoleId, now);
        }

        var existingIds = existing.Select(x => x.RoleId).ToHashSet();
        foreach (var role in roles.Where(x => !existingIds.Contains(x.Id)))
        {
            store.AddUserRole(new UserRoleAssignment(currentTenant.RequireTenantId(), command.UserId, role.Id, now));
            AddAudit(PlatformAuditAction.RoleAssigned, nameof(TenantRole), role.Id, now);
        }

        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyCollection<RoleSummary>> GetRolesAsync(CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersView, cancellationToken);
        return (await store.GetRolesAsync(cancellationToken))
            .Select(x => new RoleSummary(x.Id, x.Name, x.Description, x.IsSystemRole))
            .ToArray();
    }

    public async Task<RoleDetails?> GetRoleAsync(Guid roleId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersView, cancellationToken);
        return await store.GetRoleDetailsAsync(roleId, cancellationToken);
    }

    public async Task<Guid> CreateRoleAsync(CreateRoleCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersManageRoles, cancellationToken);
        ValidateRole(command.Name, command.Description, command.Permissions);
        EnsureNotPlatformRoleName(command.Name);
        await EnsurePermissionsAssignableAsync(command.Permissions, cancellationToken);
        var tenantId = currentTenant.RequireTenantId();
        if (await store.FindRoleByNameAsync(tenantId, command.Name.Trim().ToUpperInvariant(), cancellationToken) is not null)
        {
            throw Validation("Name", "A role with this name already exists.");
        }

        var now = clock.UtcNow;
        var role = new TenantRole(tenantId, command.Name, command.Description, false, now);
        store.AddRole(role);
        foreach (var permission in command.Permissions.Distinct(StringComparer.Ordinal))
        {
            store.AddRolePermission(new RolePermissionGrant(tenantId, role.Id, permission));
        }

        AddAudit(PlatformAuditAction.RoleCreated, nameof(TenantRole), role.Id, now);
        await store.SaveChangesAsync(cancellationToken);
        return role.Id;
    }

    public async Task<bool> UpdateRolePermissionsAsync(
        UpdateRolePermissionsCommand command,
        CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersManageRoles, cancellationToken);
        var role = await store.FindRoleAsync(command.RoleId, cancellationToken);
        if (role is null) return false;
        if (role.IsSystemRole)
        {
            throw new ForbiddenAccessException("System role permissions are protected.");
        }

        ValidatePermissions(command.Permissions);
        await EnsurePermissionsAssignableAsync(command.Permissions, cancellationToken);
        var existing = await store.GetRolePermissionEntitiesAsync(role.Id, cancellationToken);
        foreach (var item in existing) store.RemoveRolePermission(item);
        foreach (var permission in command.Permissions.Distinct(StringComparer.Ordinal))
            store.AddRolePermission(new RolePermissionGrant(currentTenant.RequireTenantId(), role.Id, permission));
        AddAudit(PlatformAuditAction.PermissionsChanged, nameof(TenantRole), role.Id, clock.UtcNow);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> UpdateRoleAsync(UpdateRoleCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.UsersManageRoles, cancellationToken);
        var role = await store.FindRoleAsync(command.RoleId, cancellationToken);
        if (role is null) return false;
        if (role.IsSystemRole) throw new ForbiddenAccessException("System roles are protected.");
        EnsureNotPlatformRoleName(command.Name);
        ValidateRole(command.Name, command.Description, await store.GetRolePermissionsAsync(role.Id, cancellationToken));
        var sameName = await store.FindRoleByNameAsync(
            currentTenant.RequireTenantId(), command.Name.Trim().ToUpperInvariant(), cancellationToken);
        if (sameName is not null && sameName.Id != role.Id)
            throw Validation("Name", "A role with this name already exists.");
        role.Update(command.Name, command.Description, clock.UtcNow);
        AddAudit(PlatformAuditAction.RoleUpdated, nameof(TenantRole), role.Id, clock.UtcNow);
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<IReadOnlyList<TenantRole>> ValidateAssignableRolesAsync(
        IReadOnlyCollection<Guid> roleIds,
        CancellationToken cancellationToken)
    {
        if (roleIds.Count == 0) throw Validation("RoleIds", "At least one tenant role is required.");
        var distinctIds = roleIds.Distinct().ToArray();
        var roles = await store.FindRolesAsync(distinctIds, cancellationToken);
        if (roles.Count != distinctIds.Length)
            throw new ForbiddenAccessException("One or more roles are outside the current tenant.");
        foreach (var role in roles)
            await EnsurePermissionsAssignableAsync(
                await store.GetRolePermissionsAsync(role.Id, cancellationToken), cancellationToken);
        return roles.ToArray();
    }

    private async Task EnsurePermissionsAssignableAsync(
        IReadOnlyCollection<string> requested,
        CancellationToken cancellationToken)
    {
        ValidatePermissions(requested);
        var actorId = currentUser.UserId ?? throw new ForbiddenAccessException("An authenticated user is required.");
        var effective = await store.GetEffectivePermissionsAsync(actorId, cancellationToken);
        if (requested.Except(effective, StringComparer.Ordinal).Any())
            throw new ForbiddenAccessException("Roles may only contain permissions held by the assigning user.");
    }

    private void AddAudit(
        PlatformAuditAction action,
        string entityType,
        Guid entityId,
        DateTimeOffset occurredAt) =>
        store.AddAudit(new PlatformAuditLog(
            currentTenant.RequireTenantId(),
            currentUser.UserId,
            action,
            entityType,
            entityId,
            occurredAt,
            null));

    private void EnsureNotSelf(Guid userId)
    {
        if (currentUser.UserId == userId)
            throw new ForbiddenAccessException("Users cannot change their own status or role assignments.");
    }

    private static void ValidateInvite(InviteUserCommand command)
    {
        var errors = new List<ValidationFailure>();
        if (string.IsNullOrWhiteSpace(command.DisplayName) || command.DisplayName.Trim().Length > 200)
            errors.Add(new("DisplayName", "Display name is required and cannot exceed 200 characters."));
        if (!MailAddress.TryCreate(command.Email, out _) || command.Email.Length > 256)
            errors.Add(new("Email", "A valid email address is required."));
        if (command.Phone?.Trim().Length > 50) errors.Add(new("Phone", "Phone cannot exceed 50 characters."));
        if (errors.Count > 0) throw new ValidationException(errors);
    }

    private static void ValidateRole(string name, string description, IReadOnlyCollection<string> permissions)
    {
        var errors = new List<ValidationFailure>();
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 100)
            errors.Add(new("Name", "Role name is required and cannot exceed 100 characters."));
        if (string.IsNullOrWhiteSpace(description) || description.Trim().Length > 500)
            errors.Add(new("Description", "Role description is required and cannot exceed 500 characters."));
        if (errors.Count > 0) throw new ValidationException(errors);
        ValidatePermissions(permissions);
    }

    private static void EnsureNotPlatformRoleName(string name)
    {
        if (string.Equals(name.Trim(), "PlatformAdmin", StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAccessException("Platform roles cannot be created or assigned by a tenant.");
    }

    private static void ValidatePermissions(IReadOnlyCollection<string> permissions)
    {
        var invalid = permissions.Where(x => !Permissions.All.Contains(x)).Distinct().ToArray();
        if (invalid.Length > 0)
            throw Validation("Permissions", "One or more permissions are not tenant-assignable.");
    }

    private static ValidationException Validation(string property, string message) =>
        new([new ValidationFailure(property, message)]);
}
