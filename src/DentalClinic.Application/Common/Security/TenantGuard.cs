using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;

namespace DentalClinic.Application.Common.Security;

internal sealed class TenantGuard(ICurrentTenant currentTenant) : ITenantGuard
{
    public void EnsureOwnedByCurrentTenant(Guid tenantId)
    {
        if (currentTenant.RequireTenantId() != tenantId)
        {
            throw new ForbiddenAccessException("The requested resource is not available in the current tenant.");
        }
    }
}
