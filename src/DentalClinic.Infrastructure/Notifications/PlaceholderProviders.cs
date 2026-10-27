using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace DentalClinic.Infrastructure.Notifications;

public sealed class EmailNotificationProvider(DentalClinic.Infrastructure.Services.PlatformMailService mail) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Email;
    public string ProviderName => "SmtpEmailProvider";

    public async Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        try
        {
            await mail.SendAsync(context.Destination, context.Subject ?? "Planora appointment", System.Net.WebUtility.HtmlEncode(context.Body).Replace("\n", "<br>", StringComparison.Ordinal), cancellationToken);
            return NotificationProviderResult.Success($"SMTP-{context.DeliveryId:N}");
        }
        catch (InvalidOperationException) { return NotificationProviderResult.NotConfigured("SMTP is not configured."); }
        catch (FormatException) { return NotificationProviderResult.PermanentFailure("INVALID_ADDRESS", "Invalid email address."); }
        catch (SmtpException) { return NotificationProviderResult.TransientFailure("SMTP_ERROR", "SMTP delivery failed."); }
    }
}

public sealed class SmsNotificationProvider : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Sms;
    public string ProviderName => "SmsNotConnectedProvider";

    public Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        return Task.FromResult(NotificationProviderResult.NotConfigured("SMS delivery is not connected to a provider."));
    }
}

public sealed class WhatsAppNotificationProvider : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.WhatsApp;
    public string ProviderName => "WhatsAppNotConnectedProvider";

    public Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        return Task.FromResult(NotificationProviderResult.NotConfigured("Automatic WhatsApp delivery is not connected. Use the WhatsApp Web action for manual sending."));
    }
}

public sealed class InAppNotificationProvider(ApplicationDbContext dbContext) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.InApp;
    public string ProviderName => "InAppProvider";

    public async Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        var item = new InAppNotification(
            context.TenantId,
            context.RecipientId,
            context.Subject ?? "Notification",
            context.Body,
            context.RelatedEntityType ?? "General",
            context.RelatedEntityType,
            context.RelatedEntityId,
            DateTimeOffset.UtcNow
        );

        await dbContext.InAppNotifications.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NotificationProviderResult.Success(item.Id.ToString("D"));
    }
}
