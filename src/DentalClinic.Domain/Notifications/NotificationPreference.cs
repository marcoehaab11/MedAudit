using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Notifications;

public sealed class NotificationPreference : TenantOwnedEntity
{
    private NotificationPreference() { }

    public NotificationPreference(
        Guid tenantId,
        string eventType,
        NotificationChannel channel,
        bool isEnabled
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(eventType)) throw new ArgumentException("Event type is required.", nameof(eventType));

        TenantId = tenantId;
        EventType = eventType.Trim();
        Channel = channel;
        IsEnabled = isEnabled;
    }

    public string EventType { get; private set; } = string.Empty;
    public NotificationChannel Channel { get; private set; }
    public bool IsEnabled { get; private set; }

    public void SetEnabled(bool isEnabled)
    {
        IsEnabled = isEnabled;
    }
}
