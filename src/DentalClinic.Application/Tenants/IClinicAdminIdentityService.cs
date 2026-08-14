namespace DentalClinic.Application.Tenants;

public interface IClinicAdminIdentityService
{
    Task<Guid> CreateAdminAsync(Guid tenantId, string email, CancellationToken cancellationToken);
}
