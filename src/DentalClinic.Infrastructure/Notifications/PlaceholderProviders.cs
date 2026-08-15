using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;

namespace DentalClinic.Infrastructure.Notifications;

public sealed class EmailNotificationProvider(IConfiguration configuration) : INotificationProvider
{
    public NotificationChannel Channel => NotificationChannel.Email;
    public string ProviderName => "EmailPlaceholderProvider";

    public Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken)
    {
        var connection = configuration["ConnectionStrings:EmailProvider"] ?? configuration["EMAIL_PROVIDER_CONNECTION"];
        if (string.IsNullOrWhiteSpace(connection))
        {
            return Task.FromResult(NotificationProviderResult.NotConfigured("Email provider is not configured."));
        }

        return Task.FromResult(NotificationProviderResult.Success($"EMAIL-{Guid.NewGuid():N}"));
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
