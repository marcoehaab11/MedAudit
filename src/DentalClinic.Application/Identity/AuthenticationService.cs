using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Identity;

internal sealed class AuthenticationService(
    IIdentityStore store,
    IIdentityCredentialService credentials,
    IAccessTokenIssuer tokenIssuer,
    ISystemClock clock) : IAuthenticationService
{
    public async Task<LoginResult?> LoginAsync(LoginCommand command, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Email) || string.IsNullOrEmpty(command.Password))
        {
            return null;
        }

        var email = command.Email.Trim().ToUpperInvariant();
        var accounts = await store.FindLoginAccountsAsync(email, cancellationToken);
        var selected = accounts.FirstOrDefault(x => x.TenantId == command.PreferredTenantId && IsAccessible(x))
            ?? accounts.Where(IsAccessible).OrderBy(x => x.TenantName, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
        if (selected is null || !await credentials.CheckPasswordAsync(selected.IdentityUserId, command.Password, cancellationToken))
        {
            return null;
        }

        return await IssueAsync(selected, accounts, cancellationToken);
    }

    public async Task<LoginResult?> SwitchClinicAsync(Guid currentTenantId, Guid membershipId, Guid targetTenantId, CancellationToken cancellationToken)
    {
        var current = await store.FindMembershipAsync(currentTenantId, membershipId, cancellationToken);
        if (current is null || !IsAccessible(current)) return null;
        var accounts = await store.FindMembershipsAsync(current.IdentityUserId, cancellationToken);
        var selected = accounts.SingleOrDefault(x => x.TenantId == targetTenantId);
        return selected is null || !IsAccessible(selected) ? null : await IssueAsync(selected, accounts, cancellationToken);
    }

    public async Task<IReadOnlyCollection<ClinicAccessSummary>> GetClinicsAsync(Guid currentTenantId, Guid membershipId, CancellationToken cancellationToken)
    {
        var current = await store.FindMembershipAsync(currentTenantId, membershipId, cancellationToken);
        if (current is null || !IsAccessible(current)) return [];
        return (await store.FindMembershipsAsync(current.IdentityUserId, cancellationToken))
            .OrderBy(x => x.TenantName, StringComparer.OrdinalIgnoreCase)
            .Select(x => new ClinicAccessSummary(x.TenantId, x.TenantName, IsAccessible(x))).ToArray();
    }

    private async Task<LoginResult> IssueAsync(LoginAccount account, IReadOnlyCollection<LoginAccount> accounts, CancellationToken cancellationToken)
    {
        var roles = await store.GetRoleNamesForUserAsync(account.TenantId, account.UserId, cancellationToken);
        var permissions = await store.GetEffectivePermissionsForUserAsync(
            account.TenantId, account.UserId, cancellationToken);
        var issued = tokenIssuer.Issue(
            account.UserId, account.TenantId, account.DisplayName, roles, permissions);
        return new LoginResult(
            issued.Token,
            issued.ExpiresAt,
            account.UserId,
            account.DisplayName,
            roles,
            permissions,
            account.TenantId,
            account.TenantName,
            accounts.OrderBy(x => x.TenantName, StringComparer.OrdinalIgnoreCase)
                .Select(x => new ClinicAccessSummary(x.TenantId, x.TenantName, IsAccessible(x))).ToArray());
    }

    private bool IsAccessible(LoginAccount account) =>
        account.UserStatus == UserStatus.Active && account.TenantStatus == TenantStatus.Active &&
        account.SubscriptionStartsAt <= clock.UtcNow && account.SubscriptionExpiresAt > clock.UtcNow;
}
