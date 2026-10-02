using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Appointments;

public sealed class BookingInquiry : TenantOwnedEntity
{
    private BookingInquiry() { }

    public BookingInquiry(Guid tenantId, string patientName, string phone, string? email,
        string? message, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Clinic is required.", nameof(tenantId));
        TenantId = tenantId;
        PatientName = Required(patientName, nameof(patientName), 200);
        Phone = Required(phone, nameof(phone), 50);
        Email = Optional(email, nameof(email), 256);
        Message = Optional(message, nameof(message), 2000);
        CreatedAt = createdAt;
    }

    public string PatientName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? Message { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? ContactedAt { get; private set; }

    public void MarkContacted(DateTimeOffset contactedAt) => ContactedAt = contactedAt;

    private static string Required(string value, string property, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", property);
        var result = value.Trim();
        return result.Length <= max ? result : throw new ArgumentException($"Value must be at most {max} characters.", property);
    }

    private static string? Optional(string? value, string property, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : Required(value, property, max);
}
