using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Identity;

internal sealed class InvitationService(
    IIdentityStore store,
    IIdentityCredentialService credentials,
    ISystemClock clock) : IInvitationService
{
    public async Task<InvitationPreview> InspectAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return new InvitationPreview(InvitationPreviewState.Invalid, null, null, null);
        }

        var account = await store.FindInvitationAsync(InvitationTokenHasher.Hash(token), cancellationToken);
        if (account is null)
        {
            return new InvitationPreview(InvitationPreviewState.Invalid, null, null, null);
        }

        var status = account.Invitation.GetEffectiveStatus(clock.UtcNow);
        return new InvitationPreview(
            Map(status),
            status == AdminInvitationStatus.Pending ? account.Invitation.Email : null,
            status == AdminInvitationStatus.Pending ? account.Invitation.Role : null,
            status == AdminInvitationStatus.Pending ? account.Invitation.ExpiresAt : null);
    }

    private static InvitationPreviewState Map(AdminInvitationStatus status) => status switch
    {
        AdminInvitationStatus.Pending => InvitationPreviewState.Pending,
        AdminInvitationStatus.Accepted => InvitationPreviewState.Accepted,
        AdminInvitationStatus.Expired => InvitationPreviewState.Expired,
        AdminInvitationStatus.Cancelled => InvitationPreviewState.Cancelled,
        _ => InvitationPreviewState.Invalid
    };

    public async Task<bool> AcceptAsync(AcceptInvitationCommand command, CancellationToken cancellationToken)
    {
        Validate(command);
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var account = await store.FindInvitationAsync(
            InvitationTokenHasher.Hash(command.Token), cancellationToken);
        if (account is null)
        {
            return false;
        }

        if (!account.Invitation.TryAccept(clock.UtcNow))
        {
            if (account.Invitation.Status == AdminInvitationStatus.Expired)
            {
                await store.SaveForTenantAsync(account.Invitation.TenantId, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }

            return false;
        }

        account.User.AcceptInvitation(clock.UtcNow);
        await credentials.SetPasswordAsync(
            account.Invitation.TenantId,
            account.Invitation.UserId,
            command.Password,
            cancellationToken);
        var acceptanceAction = string.Equals(
            account.Invitation.Role,
            SystemRoleDefinitions.ClinicAdmin,
            StringComparison.OrdinalIgnoreCase)
            ? PlatformAuditAction.AdminInvitationAccepted
            : PlatformAuditAction.InvitationAccepted;
        store.AddAudit(new PlatformAuditLog(
            account.Invitation.TenantId,
            account.Invitation.UserId,
            acceptanceAction,
            nameof(AdminInvitation),
            account.Invitation.Id,
            clock.UtcNow,
            null));
        store.AddAudit(new PlatformAuditLog(
            account.Invitation.TenantId,
            account.Invitation.UserId,
            PlatformAuditAction.UserActivated,
            nameof(ClinicUser),
            account.Invitation.UserId,
            clock.UtcNow,
            null));
        await store.SaveForTenantAsync(account.Invitation.TenantId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private static void Validate(AcceptInvitationCommand command)
    {
        var errors = new List<ValidationFailure>();
        if (string.IsNullOrWhiteSpace(command.Token)) errors.Add(new("Token", "Invitation token is required."));
        if (command.Password.Length < 12) errors.Add(new("Password", "Password must be at least 12 characters."));
        if (!string.Equals(command.Password, command.ConfirmPassword, StringComparison.Ordinal))
            errors.Add(new("ConfirmPassword", "Password confirmation does not match."));
        if (errors.Count > 0) throw new ValidationException(errors);
    }
}
