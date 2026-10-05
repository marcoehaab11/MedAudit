using DentalClinic.Application.Notifications;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Notifications;

namespace DentalClinic.Api.Endpoints;

internal static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/notifications").RequireAuthorization();

        group.MapGet("/", async (bool? unreadOnly, int? take, INotificationService s, CancellationToken t) =>
        {
            var notifications = await s.GetUserNotificationsAsync(unreadOnly ?? false, take ?? 50, t);
            return Results.Ok(notifications);
        });

        group.MapGet("/unread-count", async (INotificationService s, CancellationToken t) =>
        {
            var count = await s.GetUnreadCountAsync(t);
            return Results.Ok(new { count });
        });

        group.MapPost("/{id:guid}/read", async (Guid id, INotificationService s, CancellationToken t) =>
        {
            var success = await s.MarkAsReadAsync(id, t);
            return success ? Results.NoContent() : Results.NotFound();
        });

        group.MapPost("/read-all", async (INotificationService s, CancellationToken t) =>
        {
            var count = await s.MarkAllAsReadAsync(t);
            return Results.Ok(new { count });
        });

        group.MapGet("/templates", async (INotificationService s, CancellationToken t) =>
        {
            var templates = await s.GetTemplatesAsync(t);
            return Results.Ok(templates);
        });

        group.MapPost("/templates", async (UpsertNotificationTemplateCommand command, INotificationService s, CancellationToken t) =>
        {
            var id = await s.UpsertTemplateAsync(command, t);
            return Results.Ok(new { id });
        });

        group.MapGet("/preferences", async (INotificationService s, CancellationToken t) =>
        {
            var preferences = await s.GetPreferencesAsync(t);
            return Results.Ok(preferences);
        });

        group.MapPost("/preferences", async (UpdateNotificationPreferenceCommand command, INotificationService s, CancellationToken t) =>
        {
            await s.SetPreferenceAsync(command, t);
            return Results.NoContent();
        });

        group.MapGet("/deliveries", async (int? take, INotificationService s, CancellationToken t) =>
        {
            var deliveries = await s.GetDeliveriesAsync(take ?? 50, t);
            return Results.Ok(deliveries);
        });

        group.MapGet("/channels", async (IPermissionService permissions, IConfiguration config, CancellationToken t) =>
        {
            await permissions.EnsurePermissionAsync(Permissions.NotificationsManage, t);
            var emailReady = !string.IsNullOrWhiteSpace(config["Smtp:Host"] ?? config["SMTP_HOST"])
                && !string.IsNullOrWhiteSpace(config["Smtp:From"] ?? config["SMTP_FROM"]);
            return Results.Ok(new[] {
                new { channel = "InApp", ready = true, detail = "Worker delivers notifications to the in-app inbox." },
                new { channel = "Email", ready = emailReady, detail = emailReady ? "SMTP configured; delivery depends on server response." : "SMTP host and sender are missing." },
                new { channel = "SMS", ready = false, detail = "No SMS provider is connected." },
                new { channel = "WhatsApp", ready = false, detail = "Automatic sending is not connected; WhatsApp Web is manual." }
            });
        });

        group.MapPost("/test-in-app", async (INotificationService service, IPermissionService permissions,
            ICurrentUser user, CancellationToken t) =>
        {
            await permissions.EnsurePermissionAsync(Permissions.NotificationsManage, t);
            var userId = user.UserId ?? throw new InvalidOperationException("User ID is required.");
            var id = await service.EnqueueNotificationAsync(new NotificationRequest(
                NotificationChannel.InApp, RecipientType.Staff, userId, userId.ToString("D"),
                "TestNotification", "en", null, null, null, null), t);
            return Results.Accepted($"/api/notifications/deliveries", new { id });
        });

        return endpoints;
    }
}
