using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Notifications;

public sealed class InAppNotification : TenantOwnedEntity
{
    private InAppNotification() { }

    public InAppNotification(
        Guid tenantId,
        Guid userId,
        string title,
        string body,
        string type,
        string? relatedEntityType,
        Guid? relatedEntityId,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (userId == Guid.Empty) throw new ArgumentException("User ID is required.", nameof(userId));
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Body is required.", nameof(body));

        TenantId = tenantId;
        UserId = userId;
        Title = title.Trim();
        Body = body.Trim();
        Type = string.IsNullOrWhiteSpace(type) ? "General" : type.Trim();
        IsRead = false;
        RelatedEntityType = relatedEntityType?.Trim();
        RelatedEntityId = relatedEntityId;
        CreatedAt = createdAt;
    }

    public Guid UserId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public string Type { get; private set; } = "General";
    public bool IsRead { get; private set; }
    public DateTimeOffset? ReadAt { get; private set; }
    public string? RelatedEntityType { get; private set; }
    public Guid? RelatedEntityId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public void MarkRead(DateTimeOffset now)
    {
        if (!IsRead)
        {
            IsRead = true;
            ReadAt = now;
        }
    }
}
