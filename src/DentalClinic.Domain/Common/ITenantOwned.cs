namespace DentalClinic.Domain.Common;

public interface ITenantOwned
{
    Guid TenantId { get; }
}
