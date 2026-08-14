using DentalClinic.Application.Identity.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Identity;

internal sealed class AuthenticationService(
    IIdentityStore store,
    IIdentityCredentialService credentials,
    IAccessTokenIssuer tokenIssuer) : IAuthenticationService
{
    public async Task<LoginResult?> LoginAsync(LoginCommand command, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Email) || string.IsNullOrEmpty(command.Password))
        {
            return null;
        }

        var email = command.Email.Trim().ToUpperInvariant();
        var account = await store.FindLoginAccountAsync(email, cancellationToken);
        if (account is null ||
            account.UserStatus != UserStatus.Active ||
            account.TenantStatus != TenantStatus.Active ||
            !await credentials.CheckPasswordAsync(account.UserId, command.Password, cancellationToken))
        {
            return null;
        }

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
            permissions);
    }
}
