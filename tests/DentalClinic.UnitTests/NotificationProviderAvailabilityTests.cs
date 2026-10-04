using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Notifications;

namespace DentalClinic.UnitTests;

public sealed class NotificationProviderAvailabilityTests
{
    [Theory]
    [InlineData(NotificationChannel.Sms)]
    [InlineData(NotificationChannel.WhatsApp)]
    public async Task UnconnectedProviderNeverReportsMessageAsSent(NotificationChannel channel)
    {
        INotificationProvider provider = channel == NotificationChannel.Sms
            ? new SmsNotificationProvider() : new WhatsAppNotificationProvider();
        var context = new NotificationDispatchContext(Guid.NewGuid(), Guid.NewGuid(), channel,
            RecipientType.Patient, Guid.NewGuid(), "+201000000000", null, "Test", "ar", null, null);

        var result = await provider.SendAsync(context, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.False(result.IsConfigured);
        Assert.Null(result.ProviderMessageId);
    }
}
