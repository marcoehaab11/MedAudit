using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;

namespace DentalClinic.Application.Identity;

internal sealed class PermissionService(
    IIdentityStore store,
    ICurrentTenant currentTenant,
    ICurrentUser currentUser) : IPermissionService
{
    private Task<IReadOnlyCollection<string>>? effectivePermissions;

    public async Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken)
    {
        if (!Permissions.All.Contains(permission) || !currentTenant.IsAvailable || !currentUser.UserId.HasValue)
        {
            return false;
        }

        effectivePermissions ??= store.GetEffectivePermissionsAsync(currentUser.UserId.Value, cancellationToken);
        var permissions = await effectivePermissions;
        return permissions.Contains(permission, StringComparer.Ordinal);
    }

    public async Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken)
    {
        if (!await HasPermissionAsync(permission, cancellationToken))
        {
            throw new ForbiddenAccessException($"Permission '{permission}' is required.");
        }
    }
}
