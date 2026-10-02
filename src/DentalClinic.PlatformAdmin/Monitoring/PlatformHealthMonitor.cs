using DentalClinic.Domain.Notifications;
using DentalClinic.Domain.Platform;
using DentalClinic.Infrastructure.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.PlatformAdmin.Monitoring;

public sealed partial class PlatformHealthMonitor(
    IServiceProvider services, IHttpClientFactory httpClientFactory,
    IConfiguration configuration, ILogger<PlatformHealthMonitor> logger) : BackgroundService
{
    [LoggerMessage(EventId = 4100, Level = LogLevel.Error, Message = "Platform health monitor failed")]
    private static partial void LogMonitorFailure(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 4101, Level = LogLevel.Warning, Message = "Could not send platform health alert for {ProbeKey}: {Reason}")]
    private static partial void LogAlertFailure(ILogger logger, string probeKey, string reason);

    private sealed record Target(string Key, string Name, string? Url);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await CheckAllAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { LogMonitorFailure(logger, ex); }
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    private async Task CheckAllAsync(CancellationToken token)
    {
        var targets = new[] {
            new Target("api", "API and database", configuration["Monitoring:ApiReadyUrl"]),
            new Target("clinic-app", "Clinic app", configuration["Monitoring:ClinicAppUrl"]),
            new Target("booking-app", "Patient booking", configuration["Monitoring:BookingAppUrl"]),
        };

        foreach (var target in targets.Where(x => Uri.TryCreate(x.Url, UriKind.Absolute, out var parsed) && parsed.Scheme is "http" or "https"))
        {
            var (healthy, error) = await CheckAsync(target.Url!, token);
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var probe = await db.PlatformHealthProbes.SingleOrDefaultAsync(x => x.Key == target.Key, token);
            if (probe is null)
            {
                probe = new PlatformHealthProbe(target.Key, target.Name);
                db.PlatformHealthProbes.Add(probe);
            }
            var previous = probe.State;
            var now = DateTimeOffset.UtcNow;
            var changed = probe.Record(healthy, error, now);
            if (changed && (previous != PlatformHealthState.Unknown || probe.State == PlatformHealthState.Unhealthy))
                db.PlatformHealthEvents.Add(new PlatformHealthEvent(probe.Key, probe.State, probe.LastError, now));
            await db.SaveChangesAsync(token);
            if (changed && (previous != PlatformHealthState.Unknown || probe.State == PlatformHealthState.Unhealthy))
            {
                try { await AlertAsync(scope.ServiceProvider, probe, token); }
                catch (Exception ex) when (!token.IsCancellationRequested) { LogAlertFailure(logger, probe.Key, ex.Message); }
            }
        }
    }

    private async Task<(bool Healthy, string? Error)> CheckAsync(string url, CancellationToken token)
    {
        try
        {
            var client = httpClientFactory.CreateClient(nameof(PlatformHealthMonitor));
            using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token);
            return response.IsSuccessStatusCode
                ? (true, null)
                : (false, $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
        }
        catch (Exception ex) when (!token.IsCancellationRequested && ex is HttpRequestException or TaskCanceledException)
        {
            return (false, ex.Message);
        }
    }

    private async Task AlertAsync(IServiceProvider provider, PlatformHealthProbe probe, CancellationToken token)
    {
        var email = configuration["Monitoring:AlertEmail"];
        if (string.IsNullOrWhiteSpace(email)) return;
        var sender = provider.GetServices<INotificationProvider>().First(x => x.Channel == NotificationChannel.Email);
        var status = probe.State == PlatformHealthState.Healthy ? "recovered" : "DOWN";
        var result = await sender.SendAsync(new NotificationDispatchContext(Guid.NewGuid(), Guid.Empty,
            NotificationChannel.Email, RecipientType.Staff, Guid.Empty, email,
            $"Planora alert: {probe.Name} {status}",
            $"{probe.Name} is {status} at {probe.CheckedAt:yyyy-MM-dd HH:mm} UTC.\n{probe.LastError}\nCheck the Planora admin Operations page.",
            "en", "PlatformHealth", null), token);
        if (!result.IsSuccess) LogAlertFailure(logger, probe.Key, result.ErrorMessage ?? "Provider unavailable");
    }
}
