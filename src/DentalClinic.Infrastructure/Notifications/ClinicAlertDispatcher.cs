using System.Text.Json;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Notifications;

public static class ClinicAlertDispatcher
{
    public static async Task<int> EnqueueAsync(ApplicationDbContext db, Guid tenantId, string eventType,
        string permission, string title, string body, string entityType, Guid entityId,
        string key, CancellationToken token)
    {
        if (eventType.StartsWith("Booking", StringComparison.Ordinal))
        {
            var appointmentsEnabled = await db.TenantConfigurations.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId).Select(x => x.AppointmentsNotificationEnabled)
                .SingleOrDefaultAsync(token);
            if (!appointmentsEnabled) return 0;
        }
        var enabled = await db.NotificationPreferences.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.EventType == eventType && x.Channel == NotificationChannel.InApp)
            .Select(x => (bool?)x.IsEnabled).SingleOrDefaultAsync(token);
        if (enabled == false) return 0;
        var template = await db.NotificationTemplates.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Name == eventType &&
                x.Channel == NotificationChannel.InApp && x.Language == "en" && x.IsActive, token);
        title = string.IsNullOrWhiteSpace(template?.Subject) ? title : template.Subject;
        body = template?.Body ?? body;

        var users = await db.ClinicUsers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Status == UserStatus.Active)
            .Select(x => x.Id).ToListAsync(token);
        var profiles = await db.UserPermissionProfiles.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && users.Contains(x.UserId))
            .Select(x => new { x.UserId, x.Permissions }).ToListAsync(token);
        var profileMap = profiles.ToDictionary(x => x.UserId, x => x.Permissions);
        var roleUsers = await (from assignment in db.UserRoleAssignments.IgnoreQueryFilters().AsNoTracking()
                               join grant in db.RolePermissions.IgnoreQueryFilters().AsNoTracking()
                                   on new { assignment.TenantId, assignment.RoleId } equals new { grant.TenantId, grant.RoleId }
                               where assignment.TenantId == tenantId && grant.Permission == permission
                               select assignment.UserId).Distinct().ToListAsync(token);
        var authorized = users.Where(id => profileMap.TryGetValue(id, out var permissions)
            ? permissions.Contains(permission, StringComparer.Ordinal) : roleUsers.Contains(id)).ToList();
        if (authorized.Count == 0) return 0;

        var keys = authorized.Select(id => $"{key}:{id:N}").ToList();
        var existing = await db.NotificationDeliveries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IdempotencyKey != null && keys.Contains(x.IdempotencyKey))
            .Select(x => x.IdempotencyKey).ToListAsync(token);
        var existingKeys = existing.ToHashSet(StringComparer.Ordinal);
        var now = DateTimeOffset.UtcNow;
        var count = 0;
        foreach (var recipientId in authorized)
        {
            var recipientKey = $"{key}:{recipientId:N}";
            if (!existingKeys.Add(recipientKey)) continue;
            var destination = recipientId.ToString("D");
            var delivery = new NotificationDelivery(tenantId, NotificationChannel.InApp, RecipientType.Staff,
                recipientId, destination, template?.Id, eventType, title, body, "en", entityType, entityId,
                recipientKey, now);
            var payload = JsonSerializer.Serialize(new
            {
                DeliveryId = delivery.Id,
                TenantId = tenantId,
                Channel = NotificationChannel.InApp,
                RecipientType = RecipientType.Staff,
                RecipientId = recipientId,
                Destination = destination,
                Subject = title,
                Body = body,
                Language = "en",
                RelatedEntityType = entityType,
                RelatedEntityId = entityId
            });
            db.NotificationDeliveries.Add(delivery);
            db.OutboxMessages.Add(new OutboxMessage(Guid.NewGuid(), tenantId, "Notification.InApp", payload, now));
            count++;
        }
        if (count > 0) await db.SaveChangesAsync(token);
        return count;
    }
}
