using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using DentalClinic.Application.Identity;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Tenants;

internal sealed class ClinicManagementService(
    IPlatformClinicStore store,
    IClinicAdminIdentityService identityService,
    IInvitationTokenGenerator tokenGenerator,
    IClinicInvitationNotifier notifier,
    IEnumerable<ITenantInitializer> initializers,
    IPlatformAccessContext accessContext,
    ISystemClock clock,
    IValidator<CreateClinicCommand> createValidator,
    IValidator<UpdateClinicCommand> updateValidator) : IClinicManagementService
{
    private static readonly TimeSpan InvitationLifetime = TimeSpan.FromHours(48);

    public Task<PagedResult<ClinicListItem>> SearchAsync(
        ClinicSearchQuery query,
        CancellationToken cancellationToken)
    {
        EnsurePlatformAdmin();
        var normalized = query with
        {
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, 100)
        };
        return store.SearchAsync(normalized, cancellationToken);
    }

    public Task<ClinicDetails?> GetAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        EnsurePlatformAdmin();
        return store.GetDetailsAsync(tenantId, cancellationToken);
    }

    public async Task<CreateClinicResult> CreateAsync(
        CreateClinicCommand command,
        CancellationToken cancellationToken)
    {
        EnsurePlatformAdmin();
        await createValidator.ValidateAndThrowAsync(command, cancellationToken);

        var slug = command.Slug.Trim().ToLowerInvariant();
        if (await store.SlugExistsAsync(slug, null, cancellationToken))
        {
            throw Validation("Slug", "This clinic slug is already in use.");
        }

        var now = clock.UtcNow;
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var tenant = new Tenant(
            command.Name,
            slug,
            command.Phone,
            command.Email,
            command.Address,
            command.City,
            command.Country,
            command.TimeZone,
            command.Currency,
            now,
            command.LogoReference);

        store.AddTenant(tenant);
        await store.SavePlatformChangesAsync(tenant.Id, cancellationToken);

        var adminUserId = await identityService.CreateAdminAsync(
            tenant.Id, command.AdminEmail.Trim().ToLowerInvariant(), cancellationToken);

        foreach (var initializer in initializers)
        {
            await initializer.InitializeAsync(tenant, cancellationToken);
        }

        await store.SavePlatformChangesAsync(tenant.Id, cancellationToken);

        var clinicAdminRole = await store.FindRoleByNameAsync(
            tenant.Id,
            SystemRoleDefinitions.ClinicAdmin.ToUpperInvariant(),
            cancellationToken) ?? throw new InvalidOperationException("ClinicAdmin role initialization failed.");
        store.AddClinicUser(new ClinicUser(
            adminUserId,
            tenant.Id,
            "Clinic Administrator",
            null,
            now));
        store.AddUserRole(new UserRoleAssignment(tenant.Id, adminUserId, clinicAdminRole.Id, now));

        var token = tokenGenerator.Generate();
        var invitation = new AdminInvitation(
            tenant.Id,
            adminUserId,
            command.AdminEmail,
            SystemRoleDefinitions.ClinicAdmin,
            InvitationTokenHasher.Hash(token),
            now.Add(InvitationLifetime),
            now);
        store.AddInvitation(invitation);
        store.AddAudit(Audit(tenant.Id, PlatformAuditAction.TenantCreated, nameof(Tenant), tenant.Id, now));
        store.AddAudit(Audit(
            tenant.Id,
            PlatformAuditAction.AdminInvitationCreated,
            nameof(AdminInvitation),
            invitation.Id,
            now));
        await store.SavePlatformChangesAsync(tenant.Id, cancellationToken);

        await notifier.SendAsync(
            invitation.Id,
            invitation.Email,
            token,
            invitation.ExpiresAt,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new CreateClinicResult(tenant.Id, adminUserId, invitation.Id);
    }

    public async Task<bool> UpdateAsync(UpdateClinicCommand command, CancellationToken cancellationToken)
    {
        EnsurePlatformAdmin();
        await updateValidator.ValidateAndThrowAsync(command, cancellationToken);
        var tenant = await store.FindTenantAsync(command.Id, cancellationToken);
        if (tenant is null)
        {
            return false;
        }

        var slug = command.Slug.Trim().ToLowerInvariant();
        if (await store.SlugExistsAsync(slug, tenant.Id, cancellationToken))
        {
            throw Validation("Slug", "This clinic slug is already in use.");
        }

        var now = clock.UtcNow;
        tenant.Update(
            command.Name,
            slug,
            command.Phone,
            command.Email,
            command.Address,
            command.City,
            command.Country,
            command.TimeZone,
            command.Currency,
            now,
            command.LogoReference);
        store.AddAudit(Audit(tenant.Id, PlatformAuditAction.TenantUpdated, nameof(Tenant), tenant.Id, now));
        await store.SavePlatformChangesAsync(tenant.Id, cancellationToken);
        return true;
    }

    public async Task<bool> ChangeStatusAsync(
        Guid tenantId,
        TenantStatus status,
        CancellationToken cancellationToken)
    {
        EnsurePlatformAdmin();
        var tenant = await store.FindTenantAsync(tenantId, cancellationToken);
        if (tenant is null)
        {
            return false;
        }

        var now = clock.UtcNow;
        var action = status switch
        {
            TenantStatus.Active => PlatformAuditAction.TenantActivated,
            TenantStatus.Inactive => PlatformAuditAction.TenantDeactivated,
            TenantStatus.Suspended => PlatformAuditAction.TenantSuspended,
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported tenant status.")
        };

        switch (status)
        {
            case TenantStatus.Active: tenant.Activate(now); break;
            case TenantStatus.Inactive: tenant.Deactivate(now); break;
            case TenantStatus.Suspended: tenant.Suspend(now); break;
            default: throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported tenant status.");
        }

        store.AddAudit(Audit(tenant.Id, action, nameof(Tenant), tenant.Id, now));
        await store.SavePlatformChangesAsync(tenant.Id, cancellationToken);
        return true;
    }

    private PlatformAuditLog Audit(
        Guid tenantId,
        PlatformAuditAction action,
        string entityType,
        Guid entityId,
        DateTimeOffset now) =>
        new(tenantId, accessContext.UserId, action, entityType, entityId, now, accessContext.CorrelationId);

    private void EnsurePlatformAdmin()
    {
        if (!accessContext.IsPlatformAdmin)
        {
            throw new ForbiddenAccessException("Platform administrator access is required.");
        }
    }

    private static ValidationException Validation(string property, string message) =>
        new([new ValidationFailure(property, message)]);
}
