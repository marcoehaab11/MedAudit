using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class IdentityStore(
    ApplicationDbContext context,
    PlatformWriteScope writeScope) : IIdentityStore
{
    public async Task<IIdentityTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        new IdentityTransaction(await context.Database.BeginTransactionAsync(cancellationToken));

    public async Task<PagedResult<UserListItem>> SearchUsersAsync(
        UserSearchQuery query,
        CancellationToken cancellationToken)
    {
        var users = context.ClinicUsers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            users = users.Where(user =>
                EF.Functions.ILike(user.DisplayName, $"%{search}%") ||
                context.Users.Any(identity => identity.Id == user.Id &&
                    identity.Email != null && EF.Functions.ILike(identity.Email, $"%{search}%")));
        }

        if (query.Status.HasValue) users = users.Where(x => x.Status == query.Status.Value);
        if (query.RoleId.HasValue)
            users = users.Where(x => context.UserRoleAssignments.Any(r =>
                r.UserId == x.Id && r.RoleId == query.RoleId.Value));

        var total = await users.CountAsync(cancellationToken);
        var rows = await users.OrderBy(x => x.DisplayName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Phone,
                x.Status,
                x.CreatedAt,
                Email = context.Users.Where(identity => identity.Id == x.Id)
                    .Select(identity => identity.Email!).Single()
            })
            .ToListAsync(cancellationToken);
        var roleNames = await RoleNamesByUserAsync(rows.Select(x => x.Id).ToArray(), cancellationToken);
        var items = rows.Select(x => new UserListItem(
            x.Id, x.DisplayName, x.Email, x.Phone, x.Status,
            roleNames.GetValueOrDefault(x.Id, []), x.CreatedAt)).ToArray();
        return new PagedResult<UserListItem>(items, query.Page, query.PageSize, total);
    }

    public async Task<PagedResult<UserListItem>> SearchUsersForTenantAsync(
        Guid tenantId,
        UserSearchQuery query,
        CancellationToken cancellationToken)
    {
        var users = context.ClinicUsers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            users = users.Where(user =>
                EF.Functions.ILike(user.DisplayName, $"%{search}%") ||
                context.Users.IgnoreQueryFilters().Any(identity => identity.Id == user.Id &&
                    identity.Email != null && EF.Functions.ILike(identity.Email, $"%{search}%")));
        }
        if (query.Status.HasValue) users = users.Where(x => x.Status == query.Status.Value);
        if (query.RoleId.HasValue)
            users = users.Where(x => context.UserRoleAssignments.IgnoreQueryFilters().Any(r =>
                r.TenantId == tenantId && r.UserId == x.Id && r.RoleId == query.RoleId.Value));

        var total = await users.CountAsync(cancellationToken);
        var rows = await users.OrderBy(x => x.DisplayName)
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Phone,
                x.Status,
                x.CreatedAt,
                Email = context.Users.IgnoreQueryFilters().Where(identity => identity.Id == x.Id)
                    .Select(identity => identity.Email!).Single()
            }).ToListAsync(cancellationToken);
        var ids = rows.Select(x => x.Id).ToArray();
        var roleRows = await (from assignment in context.UserRoleAssignments.IgnoreQueryFilters().AsNoTracking()
                              join role in context.TenantRoles.IgnoreQueryFilters().AsNoTracking() on assignment.RoleId equals role.Id
                              where assignment.TenantId == tenantId && role.TenantId == tenantId && ids.Contains(assignment.UserId)
                              select new { assignment.UserId, role.Name }).ToListAsync(cancellationToken);
        var roleNames = roleRows.GroupBy(x => x.UserId).ToDictionary(
            x => x.Key, x => (IReadOnlyCollection<string>)x.Select(y => y.Name).Order(StringComparer.Ordinal).ToArray());
        var items = rows.Select(x => new UserListItem(
            x.Id, x.DisplayName, x.Email, x.Phone, x.Status,
            roleNames.GetValueOrDefault(x.Id, []), x.CreatedAt)).ToArray();
        return new PagedResult<UserListItem>(items, query.Page, query.PageSize, total);
    }

    public async Task<UserDetails?> GetUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var row = await context.ClinicUsers.AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Phone,
                x.Status,
                x.CreatedAt,
                x.UpdatedAt,
                Email = context.Users.Where(identity => identity.Id == x.Id)
                    .Select(identity => identity.Email!).Single()
            }).SingleOrDefaultAsync(cancellationToken);
        if (row is null) return null;
        var roles = await (from assignment in context.UserRoleAssignments.AsNoTracking()
                           join role in context.TenantRoles.AsNoTracking() on assignment.RoleId equals role.Id
                           where assignment.UserId == userId
                           orderby role.Name
                           select new RoleSummary(role.Id, role.Name, role.Description, role.IsSystemRole))
            .ToListAsync(cancellationToken);
        return new UserDetails(
            row.Id, row.DisplayName, row.Email, row.Phone, row.Status,
            roles, row.CreatedAt, row.UpdatedAt);
    }

    public Task<ClinicUser?> FindUserAsync(Guid userId, CancellationToken cancellationToken) =>
        context.ClinicUsers.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);

    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        context.Users.IgnoreQueryFilters().AnyAsync(
            x => x.NormalizedEmail == normalizedEmail, cancellationToken);

    public async Task<IReadOnlyCollection<TenantRole>> GetRolesAsync(CancellationToken cancellationToken) =>
        await context.TenantRoles.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<RoleDetails?> GetRoleDetailsAsync(Guid roleId, CancellationToken cancellationToken)
    {
        var role = await context.TenantRoles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == roleId, cancellationToken);
        if (role is null) return null;
        var permissions = await GetRolePermissionsAsync(roleId, cancellationToken);
        return new RoleDetails(
            role.Id, role.Name, role.Description, role.IsSystemRole,
            permissions, role.CreatedAt, role.UpdatedAt);
    }

    public Task<TenantRole?> FindRoleAsync(Guid roleId, CancellationToken cancellationToken) =>
        context.TenantRoles.SingleOrDefaultAsync(x => x.Id == roleId, cancellationToken);

    public Task<TenantRole?> FindRoleByNameAsync(
        Guid tenantId,
        string normalizedName,
        CancellationToken cancellationToken) =>
        context.TenantRoles.SingleOrDefaultAsync(
            x => x.TenantId == tenantId && x.NormalizedName == normalizedName,
            cancellationToken);

    public async Task<IReadOnlyCollection<TenantRole>> FindRolesAsync(
        IReadOnlyCollection<Guid> roleIds,
        CancellationToken cancellationToken) =>
        await context.TenantRoles.Where(x => roleIds.Contains(x.Id)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<string>> GetEffectivePermissionsAsync(
        Guid userId,
        CancellationToken cancellationToken) =>
        await EffectivePermissionsQuery(context.UserRoleAssignments, context.RolePermissions, userId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<string>> GetRolePermissionsAsync(
        Guid roleId,
        CancellationToken cancellationToken) =>
        await context.RolePermissions.AsNoTracking().Where(x => x.RoleId == roleId)
            .OrderBy(x => x.Permission).Select(x => x.Permission).ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<RolePermissionGrant>> GetRolePermissionEntitiesAsync(
        Guid roleId,
        CancellationToken cancellationToken) =>
        await context.RolePermissions.Where(x => x.RoleId == roleId).ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<UserRoleAssignment>> GetUserRoleAssignmentsAsync(
        Guid userId,
        CancellationToken cancellationToken) =>
        await context.UserRoleAssignments.Where(x => x.UserId == userId).ToListAsync(cancellationToken);

    public async Task<InvitationAccount?> FindInvitationAsync(
        string tokenHash,
        CancellationToken cancellationToken)
    {
        var invitation = await context.AdminInvitations.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (invitation is null) return null;
        var user = await context.ClinicUsers.IgnoreQueryFilters().SingleOrDefaultAsync(
            x => x.Id == invitation.UserId && x.TenantId == invitation.TenantId,
            cancellationToken);
        return user is null ? null : new InvitationAccount(invitation, user);
    }

    public Task<AdminInvitation?> FindPendingInvitationForUserAsync(
        Guid userId,
        CancellationToken cancellationToken) =>
        context.AdminInvitations.SingleOrDefaultAsync(
            x => x.UserId == userId && x.Status == AdminInvitationStatus.Pending,
            cancellationToken);

    public async Task<LoginAccount?> FindLoginAccountAsync(
        string normalizedEmail,
        CancellationToken cancellationToken) =>
        await (from identity in context.Users.IgnoreQueryFilters().AsNoTracking()
               join user in context.ClinicUsers.IgnoreQueryFilters().AsNoTracking() on identity.Id equals user.Id
               join tenant in context.Tenants.AsNoTracking() on user.TenantId equals tenant.Id
               where identity.NormalizedEmail == normalizedEmail
               select new LoginAccount(user.Id, user.TenantId, user.DisplayName, user.Status, tenant.Status))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyCollection<string>> GetRoleNamesForUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken) =>
        await (from assignment in context.UserRoleAssignments.IgnoreQueryFilters().AsNoTracking()
               join role in context.TenantRoles.IgnoreQueryFilters().AsNoTracking() on assignment.RoleId equals role.Id
               where assignment.TenantId == tenantId && role.TenantId == tenantId && assignment.UserId == userId
               orderby role.Name
               select role.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<string>> GetEffectivePermissionsForUserAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var assignments = context.UserRoleAssignments.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId);
        var rolePermissions = context.RolePermissions.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId);
        return await EffectivePermissionsQuery(assignments, rolePermissions, userId)
            .ToListAsync(cancellationToken);
    }

    public void AddUser(ClinicUser user) => context.ClinicUsers.Add(user);
    public void AddRole(TenantRole role) => context.TenantRoles.Add(role);
    public void AddRolePermission(RolePermissionGrant permission) => context.RolePermissions.Add(permission);
    public void AddUserRole(UserRoleAssignment assignment) => context.UserRoleAssignments.Add(assignment);
    public void AddInvitation(AdminInvitation invitation) => context.AdminInvitations.Add(invitation);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public void RemoveRolePermission(RolePermissionGrant permission) => context.RolePermissions.Remove(permission);
    public void RemoveUserRole(UserRoleAssignment assignment) => context.UserRoleAssignments.Remove(assignment);
    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public async Task SaveForTenantAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        using var scope = writeScope.Enter(tenantId);
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task<Dictionary<Guid, IReadOnlyCollection<string>>> RoleNamesByUserAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var rows = await (from assignment in context.UserRoleAssignments.AsNoTracking()
                          join role in context.TenantRoles.AsNoTracking() on assignment.RoleId equals role.Id
                          where userIds.Contains(assignment.UserId)
                          select new { assignment.UserId, role.Name }).ToListAsync(cancellationToken);
        return rows.GroupBy(x => x.UserId).ToDictionary(
            x => x.Key,
            x => (IReadOnlyCollection<string>)x.Select(y => y.Name).Order(StringComparer.Ordinal).ToArray());
    }

    private static IQueryable<string> EffectivePermissionsQuery(
        IQueryable<UserRoleAssignment> assignments,
        IQueryable<RolePermissionGrant> rolePermissions,
        Guid userId) =>
        (from assignment in assignments.AsNoTracking()
         join permission in rolePermissions.AsNoTracking() on assignment.RoleId equals permission.RoleId
         where assignment.UserId == userId && assignment.TenantId == permission.TenantId
         select permission.Permission).Distinct().OrderBy(x => x);
}
