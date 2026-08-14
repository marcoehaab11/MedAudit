using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Platform;

public sealed class PlatformAuditLog : Entity
{
    private PlatformAuditLog() { }

    public PlatformAuditLog(
        Guid tenantId,
        Guid? userId,
        PlatformAuditAction action,
        string entityType,
        Guid entityId,
        DateTimeOffset occurredAt,
        string? correlationId)
    {
        TenantId = tenantId;
        UserId = userId;
        Action = action;
        EntityType = entityType;
        EntityId = entityId;
        OccurredAt = occurredAt;
        CorrelationId = string.IsNullOrWhiteSpace(correlationId) ? null : correlationId.Trim();
    }

    public Guid TenantId { get; private set; }
    public Guid? UserId { get; private set; }
    public PlatformAuditAction Action { get; private set; }
    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public string? CorrelationId { get; private set; }
}
