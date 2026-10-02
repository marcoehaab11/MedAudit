using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Appointments;

public sealed class BookingPageVisit : TenantOwnedEntity
{
    private BookingPageVisit() { }

    public BookingPageVisit(Guid tenantId, string source, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Clinic is required.", nameof(tenantId));
        TenantId = tenantId;
        Source = string.IsNullOrWhiteSpace(source) ? "direct" : source.Trim().ToLowerInvariant()[..Math.Min(source.Trim().Length, 40)];
        CreatedAt = createdAt;
    }

    public string Source { get; private set; } = "direct";
    public DateTimeOffset CreatedAt { get; private set; }
}
