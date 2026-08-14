namespace DentalClinic.Application.Identity;

public interface IIdentityCredentialService
{
    Task<Guid> CreateInvitedUserAsync(Guid tenantId, string email, CancellationToken cancellationToken);
    Task SetPasswordAsync(Guid tenantId, Guid userId, string password, CancellationToken cancellationToken);
    Task<bool> CheckPasswordAsync(Guid userId, string password, CancellationToken cancellationToken);
}
