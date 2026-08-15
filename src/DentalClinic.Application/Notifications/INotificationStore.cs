using DentalClinic.Domain.Notifications;

namespace DentalClinic.Application.Notifications;

public interface INotificationStore
{
    Task<NotificationTemplate?> FindTemplateAsync(Guid tenantId, string name, NotificationChannel channel, string language, CancellationToken token);
    Task<NotificationTemplate?> FindTemplateByIdAsync(Guid tenantId, Guid templateId, CancellationToken token);
    Task<IReadOnlyCollection<NotificationTemplateDto>> GetTemplatesAsync(Guid tenantId, CancellationToken token);
    Task AddTemplateAsync(NotificationTemplate notificationTemplate, CancellationToken token);

    Task<NotificationDelivery?> FindDeliveryByIdempotencyKeyAsync(Guid tenantId, string idempotencyKey, CancellationToken token);
    Task<NotificationDelivery?> FindDeliveryByIdAsync(Guid tenantId, Guid deliveryId, CancellationToken token);
    Task<IReadOnlyCollection<NotificationDeliveryDto>> GetDeliveriesAsync(Guid tenantId, int take, CancellationToken token);
    Task AddDeliveryAsync(NotificationDelivery delivery, CancellationToken token);

    Task AddOutboxMessageAsync(OutboxMessage message, CancellationToken token);
    Task<IReadOnlyCollection<OutboxMessage>> LockPendingOutboxMessagesAsync(int batchSize, CancellationToken token);

    Task<IReadOnlyCollection<NotificationPreferenceDto>> GetPreferencesAsync(Guid tenantId, CancellationToken token);
    Task<NotificationPreference?> FindPreferenceAsync(Guid tenantId, string eventType, NotificationChannel channel, CancellationToken token);
    Task AddPreferenceAsync(NotificationPreference preference, CancellationToken token);

    Task AddInAppNotificationAsync(InAppNotification notification, CancellationToken token);
    Task<IReadOnlyCollection<InAppNotificationDto>> GetInAppNotificationsAsync(Guid tenantId, Guid userId, bool unreadOnly, int take, CancellationToken token);
    Task<int> GetUnreadInAppNotificationCountAsync(Guid tenantId, Guid userId, CancellationToken token);
    Task<InAppNotification?> FindInAppNotificationByIdAsync(Guid tenantId, Guid id, CancellationToken token);
    Task<int> MarkAllInAppNotificationsAsReadAsync(Guid tenantId, Guid userId, DateTimeOffset now, CancellationToken token);

    Task CommitAsync(CancellationToken token);
}

public interface INotificationService
{
    Task<Guid> EnqueueNotificationAsync(NotificationRequest request, CancellationToken token);
    Task<IReadOnlyCollection<InAppNotificationDto>> GetUserNotificationsAsync(bool unreadOnly, int take, CancellationToken token);
    Task<int> GetUnreadCountAsync(CancellationToken token);
    Task<bool> MarkAsReadAsync(Guid notificationId, CancellationToken token);
    Task<int> MarkAllAsReadAsync(CancellationToken token);
    Task<IReadOnlyCollection<NotificationTemplateDto>> GetTemplatesAsync(CancellationToken token);
    Task<Guid> UpsertTemplateAsync(UpsertNotificationTemplateCommand command, CancellationToken token);
    Task<IReadOnlyCollection<NotificationPreferenceDto>> GetPreferencesAsync(CancellationToken token);
    Task SetPreferenceAsync(UpdateNotificationPreferenceCommand command, CancellationToken token);
    Task<IReadOnlyCollection<NotificationDeliveryDto>> GetDeliveriesAsync(int take, CancellationToken token);
}
