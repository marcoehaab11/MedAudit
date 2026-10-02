using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace DentalClinic.Infrastructure.Notifications;

public sealed class EmailNotificationProvider(IConfiguration configuration) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Email;
    public string ProviderName => "SmtpEmailProvider";

    public async Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        var host = configuration["Smtp:Host"] ?? configuration["SMTP_HOST"];
        var from = configuration["Smtp:From"] ?? configuration["SMTP_FROM"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            return NotificationProviderResult.NotConfigured("SMTP host and sender are not configured.");
        }
        try
        {
            using var client = new SmtpClient(host, int.TryParse(configuration["Smtp:Port"] ?? configuration["SMTP_PORT"], out var port) ? port : 587)
            {
                EnableSsl = !string.Equals(configuration["Smtp:EnableSsl"] ?? configuration["SMTP_ENABLE_SSL"], "false", StringComparison.OrdinalIgnoreCase),
            };
            var user = configuration["Smtp:Username"] ?? configuration["SMTP_USERNAME"];
            var password = configuration["Smtp:Password"] ?? configuration["SMTP_PASSWORD"];
            if (!string.IsNullOrWhiteSpace(user)) client.Credentials = new NetworkCredential(user, password);
            using var message = new MailMessage(from, context.Destination, context.Subject ?? "Planora appointment", context.Body);
            await client.SendMailAsync(message, cancellationToken);
            return NotificationProviderResult.Success($"SMTP-{context.DeliveryId:N}");
        }
        catch (FormatException ex) { return NotificationProviderResult.PermanentFailure("INVALID_ADDRESS", ex.Message); }
        catch (SmtpException ex) { return NotificationProviderResult.TransientFailure("SMTP_ERROR", ex.Message); }
    }
}

public sealed class SmsNotificationProvider(IConfiguration configuration) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Sms;
    public string ProviderName => "SmsPlaceholderProvider";

    public Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        var apiKey = configuration["Sms:ApiKey"] ?? configuration["SMS_PROVIDER_KEY"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return Task.FromResult(NotificationProviderResult.NotConfigured("SMS provider is not configured."));
        }

        return Task.FromResult(NotificationProviderResult.Success($"SMS-{Guid.NewGuid():N}"));
    }
}

public sealed class WhatsAppNotificationProvider(IConfiguration configuration) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.WhatsApp;
    public string ProviderName => "WhatsAppPlaceholderProvider";

    public Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        var token = configuration["WhatsApp:Token"] ?? configuration["WHATSAPP_PROVIDER_TOKEN"];
        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult(NotificationProviderResult.NotConfigured("WhatsApp provider is not configured."));
        }

        return Task.FromResult(NotificationProviderResult.Success($"WA-{Guid.NewGuid():N}"));
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
