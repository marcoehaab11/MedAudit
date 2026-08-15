using DentalClinic.Domain.Notifications;

namespace DentalClinic.Infrastructure.Notifications;

public sealed record NotificationDispatchContext(
    Guid DeliveryId,
    Guid TenantId,
    NotificationChannel Channel,
    RecipientType RecipientType,
    Guid RecipientId,
    string Destination,
    string? Subject,
    string Body,
    string Language,
    string? RelatedEntityType,
    Guid? RelatedEntityId
);

public sealed record NotificationProviderResult(
    bool IsSuccess,
    string? ProviderMessageId,
    bool IsConfigured,
    bool IsTransientFailure,
    string? ErrorCode,
    string? ErrorMessage
)
{
    public static NotificationProviderResult Success(string providerMessageId) =>
        new(true, providerMessageId, true, false, null, null);

    public static NotificationProviderResult NotConfigured(string message) =>
        new(false, null, false, false, "NOT_CONFIGURED", message);

    public static NotificationProviderResult TransientFailure(string errorCode, string message) =>
        new(false, null, true, true, errorCode, message);

    public static NotificationProviderResult PermanentFailure(string errorCode, string message) =>
        new(false, null, true, false, errorCode, message);
}

public interface INotificationProvider
{
    NotificationChannel Channel { get; }
    string ProviderName { get; }
    Task<NotificationProviderResult> SendAsync(NotificationDispatchContext context, CancellationToken cancellationToken);
}
