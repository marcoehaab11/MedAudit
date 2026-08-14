namespace DentalClinic.Domain.Common;

public abstract class TenantOwnedEntity : Entity, ITenantOwned
{
    public Guid TenantId { get; internal set; }
}
