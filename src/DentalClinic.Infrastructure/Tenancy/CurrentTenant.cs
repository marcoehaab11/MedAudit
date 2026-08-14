using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;

namespace DentalClinic.Infrastructure.Tenancy;

public sealed class CurrentTenant : ICurrentTenant
{
    public Guid? TenantId { get; private set; }
    public bool IsAvailable => TenantId.HasValue;

    public Guid RequireTenantId() => TenantId ?? throw new TenantUnavailableException();

    public void Set(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant ID cannot be empty.", nameof(tenantId));
        }

        TenantId = tenantId;
    }
}
