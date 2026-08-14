namespace DentalClinic.Application.Common.Security;

public interface ITenantGuard
{
    void EnsureOwnedByCurrentTenant(Guid tenantId);
}
