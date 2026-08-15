namespace DentalClinic.Domain.Notifications;

public sealed class OutboxMessage
{
    private OutboxMessage() { }

    public OutboxMessage(
        Guid id,
        Guid tenantId,
        string eventType,
        string payload,
        DateTimeOffset occurredAt
    )
    {
        if (id == Guid.Empty) throw new ArgumentException("Id is required.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(eventType)) throw new ArgumentException("Event type is required.", nameof(eventType));
        if (string.IsNullOrWhiteSpace(payload)) throw new ArgumentException("Payload is required.", nameof(payload));

        Id = id;
        TenantId = tenantId;
        EventType = eventType.Trim();
        Payload = payload;
        OccurredAt = occurredAt;
        AttemptCount = 0;
        Status = OutboxStatus.Pending;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public string Payload { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public int AttemptCount { get; private set; }
    public DateTimeOffset? NextAttemptAt { get; private set; }
    public OutboxStatus Status { get; private set; }
    public string? Error { get; private set; }

    public void MarkProcessing()
    {
        Status = OutboxStatus.Processing;
        AttemptCount++;
    }

    public void MarkProcessed(DateTimeOffset now)
    {
        Status = OutboxStatus.Processed;
        ProcessedAt = now;
        Error = null;
    }

    public void ScheduleRetry(string error, DateTimeOffset nextAttemptAt)
    {
        Status = OutboxStatus.Pending;
        Error = error;
        NextAttemptAt = nextAttemptAt;
    }

    public void MarkFailed(string error)
    {
        Status = OutboxStatus.Failed;
        Error = error;
    }
}
