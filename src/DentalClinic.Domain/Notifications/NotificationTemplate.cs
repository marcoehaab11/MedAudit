using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Notifications;

public sealed class NotificationTemplate : TenantOwnedEntity
{
    private NotificationTemplate() { }

    public NotificationTemplate(
        Guid tenantId,
        string name,
        NotificationChannel channel,
        string language,
        string? subject,
        string body,
        bool isActive,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Template name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Template body is required.", nameof(body));

        TenantId = tenantId;
        Name = name.Trim();
        Channel = channel;
        Language = string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();
        Subject = subject?.Trim();
        Body = body.Trim();
        IsActive = isActive;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public NotificationChannel Channel { get; private set; }
    public string Language { get; private set; } = "en";
    public string? Subject { get; private set; }
    public string Body { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string? subject, string body, bool isActive, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Template body is required.", nameof(body));
        Subject = subject?.Trim();
        Body = body.Trim();
        IsActive = isActive;
        UpdatedAt = now;
    }
}
