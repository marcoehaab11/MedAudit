namespace DentalClinic.Application.Identity;

public interface IPermissionService
{
    Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken);
    Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken);
}
