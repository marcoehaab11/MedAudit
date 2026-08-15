using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Appointments;

public sealed class PublicBookingIdempotencyRecord : TenantOwnedEntity
{
    private PublicBookingIdempotencyRecord() { }

    public PublicBookingIdempotencyRecord(Guid tenantId, string idempotencyKey, string requestHash, string bookingReference, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(idempotencyKey)) throw new ArgumentException("Idempotency key is required.", nameof(idempotencyKey));
        if (string.IsNullOrWhiteSpace(requestHash)) throw new ArgumentException("Request hash is required.", nameof(requestHash));
        if (string.IsNullOrWhiteSpace(bookingReference)) throw new ArgumentException("Booking reference is required.", nameof(bookingReference));

        TenantId = tenantId;
        IdempotencyKey = idempotencyKey.Trim();
        RequestHash = requestHash.Trim();
        BookingReference = bookingReference.Trim();
        CreatedAt = createdAt;
    }

    public string IdempotencyKey { get; private set; } = string.Empty;
    public string RequestHash { get; private set; } = string.Empty;
    public string BookingReference { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
}
