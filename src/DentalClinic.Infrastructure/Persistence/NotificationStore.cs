using DentalClinic.Application.Notifications;
using DentalClinic.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class NotificationStore(ApplicationDbContext context) : INotificationStore
{
    public async Task<NotificationTemplate?> FindTemplateAsync(
        Guid tenantId, string name, NotificationChannel channel, string language, CancellationToken token)
    {
        return await context.NotificationTemplates.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId &&
                                      t.Name == name &&
                                      t.Channel == channel &&
                                      t.Language == language &&
                                      t.IsActive, token);
    }

    public async Task<NotificationTemplate?> FindTemplateByIdAsync(Guid tenantId, Guid templateId, CancellationToken token)
    {
        return await context.NotificationTemplates.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == templateId, token);
    }

    public async Task<IReadOnlyCollection<NotificationTemplateDto>> GetTemplatesAsync(Guid tenantId, CancellationToken token)
    {
        return await context.NotificationTemplates.AsNoTracking().IgnoreQueryFilters()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Name).ThenBy(t => t.Channel).ThenBy(t => t.Language)
            .Select(t => new NotificationTemplateDto(
                t.Id, t.Name, t.Channel, t.Language, t.Subject, t.Body, t.IsActive, t.CreatedAt, t.UpdatedAt
            )).ToListAsync(token);
    }

    public async Task AddTemplateAsync(NotificationTemplate notificationTemplate, CancellationToken token)
    {
        await context.NotificationTemplates.AddAsync(notificationTemplate, token);
    }

    public async Task<NotificationDelivery?> FindDeliveryByIdempotencyKeyAsync(Guid tenantId, string idempotencyKey, CancellationToken token)
    {
        return await context.NotificationDeliveries.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.IdempotencyKey == idempotencyKey, token);
    }

    public async Task<NotificationDelivery?> FindDeliveryByIdAsync(Guid tenantId, Guid deliveryId, CancellationToken token)
    {
        return await context.NotificationDeliveries.IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == deliveryId, token);
    }

    public async Task<IReadOnlyCollection<NotificationDeliveryDto>> GetDeliveriesAsync(Guid tenantId, int take, CancellationToken token)
    {
        return await context.NotificationDeliveries.AsNoTracking().IgnoreQueryFilters()
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .Take(take)
            .Select(d => new NotificationDeliveryDto(
                d.Id, d.Channel, d.Status, d.RecipientType, d.RecipientId, d.Destination, d.TemplateName,
                d.Subject, d.Body, d.Language, d.RelatedEntityType, d.RelatedEntityId, d.ProviderName,
                d.AttemptCount, d.LastAttemptedAt, d.SentAt, d.FailedAt, d.ErrorCode, d.ErrorMessage, d.CreatedAt
            )).ToListAsync(token);
    }

    public async Task AddDeliveryAsync(NotificationDelivery delivery, CancellationToken token)
    {
        await context.NotificationDeliveries.AddAsync(delivery, token);
    }

    public async Task AddOutboxMessageAsync(OutboxMessage message, CancellationToken token)
    {
        await context.OutboxMessages.AddAsync(message, token);
    }

    public async Task<IReadOnlyCollection<OutboxMessage>> LockPendingOutboxMessagesAsync(int batchSize, CancellationToken token)
    {
        var now = DateTimeOffset.UtcNow;
        var messages = await context.OutboxMessages
            .FromSqlInterpolated($@"
                SELECT * FROM outbox_messages
                WHERE (""Status"" = 1 OR ""Status"" = 2)
                  AND (""NextAttemptAt"" IS NULL OR ""NextAttemptAt"" <= {now})
                  AND ""AttemptCount"" < 5
                ORDER BY ""OccurredAt""
                LIMIT {batchSize}
                FOR UPDATE SKIP LOCKED")
            .ToListAsync(token);

        foreach (var msg in messages)
        {
            msg.MarkProcessing();
        }

        if (messages.Count > 0)
        {
            await context.SaveChangesAsync(token);
        }

        return messages;
    }

    public async Task<IReadOnlyCollection<NotificationPreferenceDto>> GetPreferencesAsync(Guid tenantId, CancellationToken token)
    {
        return await context.NotificationPreferences.AsNoTracking().IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId)
            .Select(p => new NotificationPreferenceDto(p.Id, p.EventType, p.Channel, p.IsEnabled))
            .ToListAsync(token);
    }

    public async Task<NotificationPreference?> FindPreferenceAsync(Guid tenantId, string eventType, NotificationChannel channel, CancellationToken token)
    {
        return await context.NotificationPreferences.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.EventType == eventType && p.Channel == channel, token);
    }

    public async Task AddPreferenceAsync(NotificationPreference preference, CancellationToken token)
    {
        await context.NotificationPreferences.AddAsync(preference, token);
    }

    public async Task AddInAppNotificationAsync(InAppNotification notification, CancellationToken token)
    {
        await context.InAppNotifications.AddAsync(notification, token);
    }

    public async Task<IReadOnlyCollection<InAppNotificationDto>> GetInAppNotificationsAsync(
        Guid tenantId, Guid userId, bool unreadOnly, int take, CancellationToken token)
    {
        var query = context.InAppNotifications.AsNoTracking().IgnoreQueryFilters()
            .Where(n => n.TenantId == tenantId && n.UserId == userId);

        if (unreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        return await query.OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new InAppNotificationDto(
                n.Id, n.Title, n.Body, n.Type, n.IsRead, n.ReadAt, n.RelatedEntityType, n.RelatedEntityId, n.CreatedAt
            )).ToListAsync(token);
    }

    public async Task<int> GetUnreadInAppNotificationCountAsync(Guid tenantId, Guid userId, CancellationToken token)
    {
        return await context.InAppNotifications.AsNoTracking().IgnoreQueryFilters()
            .CountAsync(n => n.TenantId == tenantId && n.UserId == userId && !n.IsRead, token);
    }

    public async Task<InAppNotification?> FindInAppNotificationByIdAsync(Guid tenantId, Guid id, CancellationToken token)
    {
        return await context.InAppNotifications.IgnoreQueryFilters()
            .FirstOrDefaultAsync(n => n.TenantId == tenantId && n.Id == id, token);
    }

    public async Task<int> MarkAllInAppNotificationsAsReadAsync(Guid tenantId, Guid userId, DateTimeOffset now, CancellationToken token)
    {
        var unread = await context.InAppNotifications.IgnoreQueryFilters()
            .Where(n => n.TenantId == tenantId && n.UserId == userId && !n.IsRead)
            .ToListAsync(token);

        foreach (var item in unread)
        {
            item.MarkRead(now);
        }

        return unread.Count;
    }

    public async Task CommitAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }
}
