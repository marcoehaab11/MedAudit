using System.Text.Json;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Notifications;

namespace DentalClinic.Application.Notifications;

internal sealed class NotificationService(
    INotificationStore store,
    IPermissionService permissions,
    ICurrentTenant tenant,
    ICurrentUser user,
    ISystemClock clock
) : INotificationService
{
    public async Task<Guid> EnqueueNotificationAsync(NotificationRequest request, CancellationToken token)
    {
        var tenantId = tenant.RequireTenantId();

        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await store.FindDeliveryByIdempotencyKeyAsync(tenantId, request.IdempotencyKey, token);
            if (existing != null)
            {
                return existing.Id;
            }
        }

        var template = await store.FindTemplateAsync(tenantId, request.TemplateName, request.Channel, request.Language, token)
            ?? await store.FindTemplateAsync(tenantId, request.TemplateName, request.Channel, "en", token);

        var subject = template?.Subject ?? $"{request.TemplateName} Notification";
        var rawBody = template?.Body ?? $"Notification for {request.TemplateName}";
        var body = NotificationTemplateEngine.Render(rawBody, request.Variables);

        var delivery = new NotificationDelivery(
            tenantId,
            request.Channel,
            request.RecipientType,
            request.RecipientId,
            request.Destination,
            template?.Id,
            request.TemplateName,
            subject,
            body,
            request.Language,
            request.RelatedEntityType,
            request.RelatedEntityId,
            request.IdempotencyKey,
            clock.UtcNow
        );

        await store.AddDeliveryAsync(delivery, token);

        var payload = JsonSerializer.Serialize(new
        {
            DeliveryId = delivery.Id,
            TenantId = tenantId,
            Channel = request.Channel,
            RecipientType = request.RecipientType,
            RecipientId = request.RecipientId,
            Destination = request.Destination,
            Subject = subject,
            Body = body,
            Language = request.Language,
            RelatedEntityType = request.RelatedEntityType,
            RelatedEntityId = request.RelatedEntityId
        });

        var outboxMessage = new OutboxMessage(
            Guid.NewGuid(),
            tenantId,
            $"Notification.{request.Channel}",
            payload,
            clock.UtcNow
        );

        await store.AddOutboxMessageAsync(outboxMessage, token);
        await store.CommitAsync(token);

        return delivery.Id;
    }

    public async Task<IReadOnlyCollection<InAppNotificationDto>> GetUserNotificationsAsync(bool unreadOnly, int take, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsView, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");
        return await store.GetInAppNotificationsAsync(tenantId, userId, unreadOnly, Math.Clamp(take, 1, 100), token);
    }

    public async Task<int> GetUnreadCountAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsView, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");
        return await store.GetUnreadInAppNotificationCountAsync(tenantId, userId, token);
    }

    public async Task<bool> MarkAsReadAsync(Guid notificationId, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsView, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");

        var item = await store.FindInAppNotificationByIdAsync(tenantId, notificationId, token);
        if (item == null || item.UserId != userId)
        {
            return false;
        }

        item.MarkRead(clock.UtcNow);
        await store.CommitAsync(token);
        return true;
    }

    public async Task<int> MarkAllAsReadAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsView, token);
        var tenantId = tenant.RequireTenantId();
        var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");

        var count = await store.MarkAllInAppNotificationsAsReadAsync(tenantId, userId, clock.UtcNow, token);
        await store.CommitAsync(token);
        return count;
    }

    public async Task<IReadOnlyCollection<NotificationTemplateDto>> GetTemplatesAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsTemplates, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetTemplatesAsync(tenantId, token);
    }

    public async Task<Guid> UpsertTemplateAsync(UpsertNotificationTemplateCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsTemplates, token);
        var tenantId = tenant.RequireTenantId();

        var existing = await store.FindTemplateAsync(tenantId, command.Name, command.Channel, command.Language, token);
        if (existing != null)
        {
            existing.Update(command.Subject, command.Body, command.IsActive, clock.UtcNow);
            await store.CommitAsync(token);
            return existing.Id;
        }

        var template = new NotificationTemplate(
            tenantId,
            command.Name,
            command.Channel,
            command.Language,
            command.Subject,
            command.Body,
            command.IsActive,
            clock.UtcNow
        );

        await store.AddTemplateAsync(template, token);
        await store.CommitAsync(token);
        return template.Id;
    }

    public async Task<IReadOnlyCollection<NotificationPreferenceDto>> GetPreferencesAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsPreferences, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetPreferencesAsync(tenantId, token);
    }

    public async Task SetPreferenceAsync(UpdateNotificationPreferenceCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsPreferences, token);
        var tenantId = tenant.RequireTenantId();

        var pref = await store.FindPreferenceAsync(tenantId, command.EventType, command.Channel, token);
        if (pref != null)
        {
            pref.SetEnabled(command.IsEnabled);
        }
        else
        {
            pref = new NotificationPreference(tenantId, command.EventType, command.Channel, command.IsEnabled);
            await store.AddPreferenceAsync(pref, token);
        }

        await store.CommitAsync(token);
    }

    public async Task<IReadOnlyCollection<NotificationDeliveryDto>> GetDeliveriesAsync(int take, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.NotificationsManage, token);
        var tenantId = tenant.RequireTenantId();
        return await store.GetDeliveriesAsync(tenantId, Math.Clamp(take, 1, 100), token);
    }
}
