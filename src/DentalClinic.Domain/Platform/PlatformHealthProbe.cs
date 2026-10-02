namespace DentalClinic.Domain.Platform;

public enum PlatformHealthState { Unknown = 0, Healthy = 1, Unhealthy = 2 }

public sealed class PlatformHealthProbe
{
    private PlatformHealthProbe() { }
    public PlatformHealthProbe(string key, string name)
    {
        Key = key;
        Name = name;
    }

    public string Key { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public PlatformHealthState State { get; private set; }
    public int ConsecutiveFailures { get; private set; }
    public DateTimeOffset? CheckedAt { get; private set; }
    public DateTimeOffset? LastSuccessAt { get; private set; }
    public DateTimeOffset? ChangedAt { get; private set; }
    public string? LastError { get; private set; }

    public bool Record(bool healthy, string? error, DateTimeOffset now)
    {
        CheckedAt = now;
        if (healthy)
        {
            ConsecutiveFailures = 0;
            LastSuccessAt = now;
            LastError = null;
            if (State == PlatformHealthState.Healthy) return false;
            State = PlatformHealthState.Healthy;
            ChangedAt = now;
            return true;
        }

        ConsecutiveFailures++;
        LastError = string.IsNullOrWhiteSpace(error) ? "Health check failed." : error.Trim()[..Math.Min(error.Trim().Length, 500)];
        if (ConsecutiveFailures < 2 || State == PlatformHealthState.Unhealthy) return false;
        State = PlatformHealthState.Unhealthy;
        ChangedAt = now;
        return true;
    }
}

public sealed class PlatformHealthEvent
{
    private PlatformHealthEvent() { }
    public PlatformHealthEvent(string probeKey, PlatformHealthState state, string? details, DateTimeOffset occurredAt)
    {
        Id = Guid.NewGuid();
        ProbeKey = probeKey;
        State = state;
        Details = details;
        OccurredAt = occurredAt;
    }

    public Guid Id { get; private set; }
    public string ProbeKey { get; private set; } = string.Empty;
    public PlatformHealthState State { get; private set; }
    public string? Details { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
}
