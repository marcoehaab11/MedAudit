using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Notifications;

public sealed class NotificationDelivery : TenantOwnedEntity
{
    private NotificationDelivery() { }

    public NotificationDelivery(
        Guid tenantId,
        NotificationChannel channel,
        RecipientType recipientType,
        Guid recipientId,
        string destination,
        Guid? templateId,
        string templateName,
        string? subject,
        string body,
        string language,
        string? relatedEntityType,
        Guid? relatedEntityId,
        string? idempotencyKey,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (recipientId == Guid.Empty) throw new ArgumentException("Recipient ID is required.", nameof(recipientId));
        if (string.IsNullOrWhiteSpace(destination)) throw new ArgumentException("Destination is required.", nameof(destination));
        if (string.IsNullOrWhiteSpace(templateName)) throw new ArgumentException("Template name is required.", nameof(templateName));
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Notification body is required.", nameof(body));

        TenantId = tenantId;
        Channel = channel;
        Status = NotificationStatus.Pending;
        RecipientType = recipientType;
        RecipientId = recipientId;
        Destination = destination.Trim();
        TemplateId = templateId;
        TemplateName = templateName.Trim();
        Subject = subject?.Trim();
        Body = body.Trim();
        Language = string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();
        RelatedEntityType = relatedEntityType?.Trim();
        RelatedEntityId = relatedEntityId;
        IdempotencyKey = idempotencyKey?.Trim();
        AttemptCount = 0;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public NotificationChannel Channel { get; private set; }
    public NotificationStatus Status { get; private set; }
    public RecipientType RecipientType { get; private set; }
    public Guid RecipientId { get; private set; }
    public string Destination { get; private set; } = string.Empty;
    public Guid? TemplateId { get; private set; }
    public string TemplateName { get; private set; } = string.Empty;
    public string? Subject { get; private set; }
    public string Body { get; private set; } = string.Empty;
    public string Language { get; private set; } = "en";
    public string? RelatedEntityType { get; private set; }
    public Guid? RelatedEntityId { get; private set; }
    public string? ProviderName { get; private set; }
    public string? ProviderMessageId { get; private set; }
    public int AttemptCount { get; private set; }
    public DateTimeOffset? LastAttemptedAt { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public DateTimeOffset? FailedAt { get; private set; }
    public string? ErrorCode { get; private set; }
    public string? ErrorMessage { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void MarkProcessing(DateTimeOffset now)
    {
        Status = NotificationStatus.Processing;
        AttemptCount++;
        LastAttemptedAt = now;
        UpdatedAt = now;
    }

    public void MarkSent(string providerName, string? providerMessageId, DateTimeOffset now)
    {
        Status = NotificationStatus.Sent;
        ProviderName = providerName;
        ProviderMessageId = providerMessageId;
        SentAt = now;
        UpdatedAt = now;
        ErrorCode = null;
        ErrorMessage = null;
    }

    public void MarkFailed(string providerName, string errorCode, string errorMessage, DateTimeOffset now)
    {
        Status = NotificationStatus.Failed;
        ProviderName = providerName;
        ErrorCode = errorCode;
        ErrorMessage = errorMessage;
        FailedAt = now;
        UpdatedAt = now;
    }

    public void MarkCancelled(string reason, DateTimeOffset now)
    {
        Status = NotificationStatus.Cancelled;
        ErrorCode = "CANCELLED";
        ErrorMessage = reason;
        UpdatedAt = now;
    }
}
