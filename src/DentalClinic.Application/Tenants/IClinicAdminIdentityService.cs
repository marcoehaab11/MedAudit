using DentalClinic.Application.Identity;

namespace DentalClinic.Application.Tenants;

public interface IClinicAdminIdentityService
{
    Task<IdentityAccountLink> CreateAdminAsync(Guid tenantId, string email, CancellationToken cancellationToken);
}
