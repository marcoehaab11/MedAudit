namespace DentalClinic.Infrastructure.Persistence;

public sealed class PlatformWriteScope
{
    internal Guid? TenantId { get; private set; }

    internal IDisposable Enter(Guid tenantId)
    {
        if (tenantId == Guid.Empty || TenantId.HasValue)
        {
            throw new InvalidOperationException("A valid, non-nested platform tenant scope is required.");
        }

        TenantId = tenantId;
        return new Scope(this);
    }

    private sealed class Scope(PlatformWriteScope owner) : IDisposable
    {
        public void Dispose() => owner.TenantId = null;
    }
}
