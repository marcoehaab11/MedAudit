using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PlatformClinicStore(
    ApplicationDbContext context,
    PlatformWriteScope writeScope) : IPlatformClinicStore
{
    public async Task<IPlatformTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        new PlatformTransaction(await context.Database.BeginTransactionAsync(cancellationToken));

    public async Task<PagedResult<ClinicListItem>> SearchAsync(
        ClinicSearchQuery query,
        CancellationToken cancellationToken)
    {
        var tenants = context.Tenants.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            tenants = tenants.Where(x =>
                EF.Functions.ILike(x.Name, $"%{search}%") ||
                EF.Functions.ILike(x.Slug, $"%{search}%") ||
                EF.Functions.ILike(x.Email, $"%{search}%"));
        }

        if (query.Status.HasValue)
        {
            tenants = tenants.Where(x => x.Status == query.Status.Value);
        }

        var totalCount = await tenants.CountAsync(cancellationToken);
        var adminUsers = context.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(user => user.TenantId.HasValue &&
                context.UserRoleAssignments.IgnoreQueryFilters().Any(assignment =>
                    assignment.UserId == user.Id &&
                    context.TenantRoles.IgnoreQueryFilters().Any(role =>
                        role.Id == assignment.RoleId &&
                        role.NormalizedName == AuthConstants.ClinicAdminRoleNormalized)));

        var items = await tenants
            .OrderBy(x => x.Name)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(tenant => new ClinicListItem(
                tenant.Id,
                tenant.Name,
                tenant.Slug,
                tenant.Status,
                tenant.Country,
                tenant.City,
                adminUsers.Where(user => user.TenantId == tenant.Id)
                    .Select(user => user.Email)
                    .FirstOrDefault(),
                tenant.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResult<ClinicListItem>(items, query.Page, query.PageSize, totalCount);
    }

    public async Task<ClinicDetails?> GetDetailsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var adminUsers = context.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(user => user.TenantId == tenantId &&
                context.UserRoleAssignments.IgnoreQueryFilters().Any(assignment =>
                    assignment.UserId == user.Id &&
                    context.TenantRoles.IgnoreQueryFilters().Any(role =>
                        role.Id == assignment.RoleId &&
                        role.NormalizedName == AuthConstants.ClinicAdminRoleNormalized)));

        return await context.Tenants.AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(tenant => new ClinicDetails(
                tenant.Id,
                tenant.Name,
                tenant.Slug,
                tenant.Phone,
                tenant.Email,
                tenant.Address,
                tenant.City,
                tenant.Country,
                tenant.TimeZone,
                tenant.Currency,
                tenant.LogoReference,
                tenant.Status,
                adminUsers.Select(user => user.Email).FirstOrDefault(),
                tenant.CreatedAt,
                tenant.UpdatedAt))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken) =>
        context.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

    public Task<bool> SlugExistsAsync(
        string slug,
        Guid? excludingTenantId,
        CancellationToken cancellationToken) =>
        context.Tenants.AnyAsync(
            x => x.Slug == slug && (!excludingTenantId.HasValue || x.Id != excludingTenantId.Value),
            cancellationToken);

    public Task<AdminInvitation?> FindInvitationByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken) =>
        context.AdminInvitations.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

    public Task<TenantRole?> FindRoleByNameAsync(
        Guid tenantId,
        string normalizedName,
        CancellationToken cancellationToken) =>
        context.TenantRoles.IgnoreQueryFilters().SingleOrDefaultAsync(
            x => x.TenantId == tenantId && x.NormalizedName == normalizedName,
            cancellationToken);

    public void AddTenant(Tenant tenant) => context.Tenants.Add(tenant);
    public void AddTenantConfiguration(TenantConfiguration configuration) =>
        context.TenantConfigurations.Add(configuration);
    public void AddInvitation(AdminInvitation invitation) => context.AdminInvitations.Add(invitation);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public void AddClinicUser(ClinicUser user) => context.ClinicUsers.Add(user);
    public void AddTenantRole(TenantRole role) => context.TenantRoles.Add(role);
    public void AddRolePermission(RolePermissionGrant permission) => context.RolePermissions.Add(permission);
    public void AddUserRole(UserRoleAssignment assignment) => context.UserRoleAssignments.Add(assignment);

    public async Task SavePlatformChangesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        using var scope = writeScope.Enter(tenantId);
        await context.SaveChangesAsync(cancellationToken);
    }
}
