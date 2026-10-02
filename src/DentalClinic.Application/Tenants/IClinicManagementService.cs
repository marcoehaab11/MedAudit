using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public interface IClinicManagementService
{
    Task<PagedResult<ClinicListItem>> SearchAsync(ClinicSearchQuery query, CancellationToken cancellationToken);
    Task<ClinicDetails?> GetAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<CreateClinicResult> CreateAsync(CreateClinicCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(UpdateClinicCommand command, CancellationToken cancellationToken);
    Task<bool> ChangeStatusAsync(Guid tenantId, TenantStatus status, CancellationToken cancellationToken);
    Task<bool> ExtendSubscriptionAsync(Guid tenantId, int months, CancellationToken cancellationToken);
    Task<bool> SetUserActiveAsync(Guid tenantId, Guid userId, bool active, CancellationToken cancellationToken);
}
