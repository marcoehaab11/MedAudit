using System.Text.Json;
using DentalClinic.Application.Crm;
using DentalClinic.Application.Notifications;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Notifications;
using DentalClinic.Infrastructure.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DentalClinic.Worker;

public sealed partial class NotificationOutboxProcessorHost(
    IServiceProvider serviceProvider,
    ILogger<NotificationOutboxProcessorHost> logger
) : BackgroundService
{
    private static readonly TimeSpan PollingInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan[] RetryBackoffs =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromMinutes(60)
    ];

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Notification Outbox Processor started.")]
    private static partial void LogProcessorStarted(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Notification Outbox Processor stopped.")]
    private static partial void LogProcessorStopped(ILogger logger);

    [LoggerMessage(EventId = 3, Level = LogLevel.Error, Message = "Error processing notification outbox batch.")]
    private static partial void LogBatchError(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 4, Level = LogLevel.Warning, Message = "Failed to record CRM CommunicationActivity for delivery {DeliveryId}")]
    private static partial void LogCrmRecordError(ILogger logger, Guid deliveryId, Exception exception);

    [LoggerMessage(EventId = 5, Level = LogLevel.Error, Message = "Failed to dispatch outbox message {MessageId}")]
    private static partial void LogDispatchError(ILogger logger, Guid messageId, Exception exception);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogProcessorStarted(logger);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                LogBatchError(logger, ex);
            }

            await Task.Delay(PollingInterval, stoppingToken);
        }

        LogProcessorStopped(logger);
    }

    private async Task ProcessBatchAsync(CancellationToken token)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<INotificationStore>();
        var providers = scope.ServiceProvider.GetServices<INotificationProvider>().ToDictionary(p => p.Channel);
        var crmStore = scope.ServiceProvider.GetService<ICrmStore>();

        var messages = await store.LockPendingOutboxMessagesAsync(20, token);
        if (messages.Count == 0) return;

        var now = DateTimeOffset.UtcNow;

        foreach (var msg in messages)
        {
            try
            {
                using var json = JsonDocument.Parse(msg.Payload);
                var root = json.RootElement;
                var deliveryId = root.GetProperty("DeliveryId").GetGuid();
                var tenantId = root.GetProperty("TenantId").GetGuid();
                var channel = (NotificationChannel)root.GetProperty("Channel").GetInt32();
                var recipientType = (RecipientType)root.GetProperty("RecipientType").GetInt32();
                var recipientId = root.GetProperty("RecipientId").GetGuid();
                var destination = root.GetProperty("Destination").GetString() ?? string.Empty;
                var subject = root.TryGetProperty("Subject", out var s) ? s.GetString() : null;
                var body = root.GetProperty("Body").GetString() ?? string.Empty;
                var language = root.GetProperty("Language").GetString() ?? "en";
                var relatedEntityType = root.TryGetProperty("RelatedEntityType", out var ret) ? ret.GetString() : null;
                var relatedEntityId = root.TryGetProperty("RelatedEntityId", out var rei) && rei.ValueKind != JsonValueKind.Null ? (Guid?)rei.GetGuid() : null;

                var delivery = await store.FindDeliveryByIdAsync(tenantId, deliveryId, token);
                if (delivery == null)
                {
                    msg.MarkFailed("Notification delivery record not found.");
                    continue;
                }

                delivery.MarkProcessing(now);

                if (!providers.TryGetValue(channel, out var provider))
                {
                    delivery.MarkFailed("System", "NO_PROVIDER", $"No provider registered for channel {channel}", now);
                    msg.MarkFailed($"No provider registered for channel {channel}");
                    continue;
                }

                var dispatchContext = new NotificationDispatchContext(
                    deliveryId, tenantId, channel, recipientType, recipientId, destination, subject, body, language, relatedEntityType, relatedEntityId
                );

                var result = await provider.SendAsync(dispatchContext, token);

                if (result.IsSuccess)
                {
                    delivery.MarkSent(provider.ProviderName, result.ProviderMessageId, now);
                    msg.MarkProcessed(now);

                    // Re-use CRM CommunicationActivity integration for successfully sent patient notifications
                    if (recipientType == RecipientType.Patient && crmStore != null)
                    {
                        try
                        {
                            var commType = channel switch
                            {
                                NotificationChannel.Sms => CommunicationType.Sms,
                                NotificationChannel.WhatsApp => CommunicationType.WhatsApp,
                                NotificationChannel.Email => CommunicationType.Email,
                                _ => CommunicationType.Other
                            };

                            var activity = new CommunicationActivity(
                                tenantId,
                                recipientId,
                                Guid.Empty, // System triggered
                                commType,
                                CommunicationDirection.Outbound,
                                subject ?? "Automated Notification",
                                body,
                                now,
                                now
                            );

                            crmStore.AddActivity(activity);
                            await crmStore.SaveChangesAsync(token);
                        }
                        catch (Exception ex)
                        {
                            LogCrmRecordError(logger, deliveryId, ex);
                        }
                    }
                }
                else if (!result.IsConfigured || !result.IsTransientFailure)
                {
                    delivery.MarkFailed(provider.ProviderName, result.ErrorCode ?? "FAILED", result.ErrorMessage ?? "Provider returned permanent error.", now);
                    msg.MarkFailed(result.ErrorMessage ?? "Permanent failure.");
                }
                else
                {
                    // Transient failure -> Exponential backoff retry
                    if (msg.AttemptCount < 5)
                    {
                        var backoffIndex = Math.Min(msg.AttemptCount - 1, RetryBackoffs.Length - 1);
                        var nextAttemptAt = now.Add(RetryBackoffs[backoffIndex]);
                        msg.ScheduleRetry(result.ErrorMessage ?? "Transient provider failure.", nextAttemptAt);
                    }
                    else
                    {
                        delivery.MarkFailed(provider.ProviderName, result.ErrorCode ?? "MAX_ATTEMPTS", "Maximum retry attempts reached.", now);
                        msg.MarkFailed("Maximum retry attempts reached.");
                    }
                }
            }
            catch (Exception ex)
            {
                LogDispatchError(logger, msg.Id, ex);
                msg.ScheduleRetry(ex.Message, now.AddMinutes(1));
            }
        }

        await store.CommitAsync(token);
    }
}
