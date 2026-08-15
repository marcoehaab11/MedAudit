using DentalClinic.Domain.Notifications;

namespace DentalClinic.Application.Notifications;

public sealed record NotificationRequest(
    NotificationChannel Channel,
    RecipientType RecipientType,
    Guid RecipientId,
    string Destination,
    string TemplateName,
    string Language,
    IReadOnlyDictionary<string, string>? Variables,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    string? IdempotencyKey
);

public sealed record NotificationDeliveryDto(
    Guid Id,
    NotificationChannel Channel,
    NotificationStatus Status,
    RecipientType RecipientType,
    Guid RecipientId,
    string Destination,
    string TemplateName,
    string? Subject,
    string Body,
    string Language,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    string? ProviderName,
    int AttemptCount,
    DateTimeOffset? LastAttemptedAt,
    DateTimeOffset? SentAt,
    DateTimeOffset? FailedAt,
    string? ErrorCode,
    string? ErrorMessage,
    DateTimeOffset CreatedAt
);

public sealed record NotificationTemplateDto(
    Guid Id,
    string Name,
    NotificationChannel Channel,
    string Language,
    string? Subject,
    string Body,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public sealed record UpsertNotificationTemplateCommand(
    string Name,
    NotificationChannel Channel,
    string Language,
    string? Subject,
    string Body,
    bool IsActive
);

public sealed record NotificationPreferenceDto(
    Guid Id,
    string EventType,
    NotificationChannel Channel,
    bool IsEnabled
);

public sealed record UpdateNotificationPreferenceCommand(
    string EventType,
    NotificationChannel Channel,
    bool IsEnabled
);

public sealed record InAppNotificationDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsRead,
    DateTimeOffset? ReadAt,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    DateTimeOffset CreatedAt
);
