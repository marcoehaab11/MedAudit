using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public interface ITenantInitializer
{
    Task InitializeAsync(Tenant tenant, CancellationToken cancellationToken);
}
