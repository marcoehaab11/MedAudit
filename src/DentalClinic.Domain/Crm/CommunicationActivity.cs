using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Crm;

public sealed class CommunicationActivity : TenantOwnedEntity
{
    private CommunicationActivity() { }
    public CommunicationActivity(Guid tenantId, Guid patientId, Guid userId, CommunicationType type,
        CommunicationDirection direction, string? subject, string? notes, DateTimeOffset occurredAt, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || userId == Guid.Empty) throw new ArgumentException("Tenant, patient, and user are required.");
        if (!Enum.IsDefined(type) || !Enum.IsDefined(direction)) throw new ArgumentOutOfRangeException(nameof(type));
        if (occurredAt.Offset != TimeSpan.Zero) throw new ArgumentException("Occurred time must be UTC.", nameof(occurredAt));
        TenantId = tenantId; PatientId = patientId; UserId = userId; Type = type; Direction = direction;
        Subject = Optional(subject, nameof(subject), 200); Notes = Optional(notes, nameof(notes), 1000); OccurredAt = occurredAt; CreatedAt = createdAt;
    }
    public Guid PatientId { get; private set; }
    public Guid UserId { get; private set; }
    public CommunicationType Type { get; private set; }
    public CommunicationDirection Direction { get; private set; }
    public string? Subject { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    private static string? Optional(string? value, string name, int max) { if (string.IsNullOrWhiteSpace(value)) return null; var x = value.Trim(); return x.Length <= max ? x : throw new ArgumentException($"Value cannot exceed {max} characters.", name); }
}
