namespace DentalClinic.Application.Common.Interfaces;

public interface ICurrentTenant
{
    Guid? TenantId { get; }
    bool IsAvailable { get; }
    Guid RequireTenantId();
}
