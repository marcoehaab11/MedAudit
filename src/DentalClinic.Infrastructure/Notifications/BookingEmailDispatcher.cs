using System.Text.Json;
using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Notifications;

public static class BookingEmailDispatcher
{
    public static async Task<bool> EnqueueAsync(ApplicationDbContext db, Guid tenantId, Guid patientId,
        Guid appointmentId, string email, string template, string subject, string body, string key,
        CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        if (await db.NotificationDeliveries.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenantId && x.IdempotencyKey == key, token))
            return false;
        var now = DateTimeOffset.UtcNow;
        var delivery = new NotificationDelivery(tenantId, NotificationChannel.Email, RecipientType.Patient,
            patientId, email, null, template, subject, body, "en", "Appointment", appointmentId, key, now);
        var payload = JsonSerializer.Serialize(new {
            DeliveryId = delivery.Id, TenantId = tenantId, Channel = NotificationChannel.Email,
            RecipientType = RecipientType.Patient, RecipientId = patientId, Destination = email,
            Subject = subject, Body = body, Language = "en", RelatedEntityType = "Appointment",
            RelatedEntityId = appointmentId
        });
        db.NotificationDeliveries.Add(delivery);
        db.OutboxMessages.Add(new OutboxMessage(Guid.NewGuid(), tenantId, "Notification.Email", payload, now));
        await db.SaveChangesAsync(token);
        return true;
    }
}
