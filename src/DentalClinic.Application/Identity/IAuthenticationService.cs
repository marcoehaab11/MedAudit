using DentalClinic.Application.Identity.Models;

namespace DentalClinic.Application.Identity;

public interface IAuthenticationService
{
    Task<LoginResult?> LoginAsync(LoginCommand command, CancellationToken cancellationToken);
    Task<LoginResult?> SwitchClinicAsync(Guid currentTenantId, Guid membershipId, Guid targetTenantId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ClinicAccessSummary>> GetClinicsAsync(Guid currentTenantId, Guid membershipId, CancellationToken cancellationToken);
}
