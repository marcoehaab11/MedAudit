using DentalClinic.Domain.Platform;

namespace DentalClinic.UnitTests;

public sealed class PlatformHealthProbeTests
{
    [Fact]
    public void RequiresTwoFailuresAndRecordsRecovery()
    {
        var probe = new PlatformHealthProbe("api", "API");
        var now = new DateTimeOffset(2026, 10, 2, 12, 0, 0, TimeSpan.Zero);

        Assert.False(probe.Record(false, "timeout", now));
        Assert.Equal(PlatformHealthState.Unknown, probe.State);
        Assert.True(probe.Record(false, "HTTP 502", now.AddMinutes(1)));
        Assert.Equal(PlatformHealthState.Unhealthy, probe.State);
        Assert.Equal(2, probe.ConsecutiveFailures);
        Assert.False(probe.Record(false, "HTTP 502", now.AddMinutes(2)));

        Assert.True(probe.Record(true, null, now.AddMinutes(3)));
        Assert.Equal(PlatformHealthState.Healthy, probe.State);
        Assert.Equal(0, probe.ConsecutiveFailures);
        Assert.Null(probe.LastError);
        Assert.Equal(now.AddMinutes(3), probe.LastSuccessAt);
    }
}
