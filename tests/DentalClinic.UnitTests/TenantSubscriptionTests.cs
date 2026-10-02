using DentalClinic.Domain.Tenancy;

namespace DentalClinic.UnitTests;

public sealed class TenantSubscriptionTests
{
    private static Tenant Create(DateTimeOffset start, int months) => new(
        "Clinic", "clinic", "123", "clinic@example.com", "Address", "Cairo", "Egypt",
        "Africa/Cairo", "EGP", start, subscriptionMonths: months);

    [Fact]
    public void InitialDurationStartsAtCreationAndExpiresAtMonthBoundary()
    {
        var start = new DateTimeOffset(2026, 1, 31, 12, 0, 0, TimeSpan.Zero);
        var tenant = Create(start, 2);

        Assert.Equal(start, tenant.SubscriptionStartsAt);
        Assert.Equal(start.AddMonths(2), tenant.SubscriptionExpiresAt);
        Assert.True(tenant.HasActiveSubscription(tenant.SubscriptionExpiresAt.AddTicks(-1)));
        Assert.False(tenant.HasActiveSubscription(tenant.SubscriptionExpiresAt));
    }

    [Fact]
    public void RenewalAddsToRemainingTermAndRestartsAnExpiredTerm()
    {
        var start = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var tenant = Create(start, 1);
        tenant.ExtendSubscription(2, start.AddDays(10));
        Assert.Equal(start.AddMonths(1).AddMonths(2), tenant.SubscriptionExpiresAt);

        var renewedAt = start.AddYears(1);
        tenant.ExtendSubscription(1, renewedAt);
        Assert.Equal(renewedAt, tenant.SubscriptionStartsAt);
        Assert.Equal(renewedAt.AddMonths(1), tenant.SubscriptionExpiresAt);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(121)]
    public void RejectsInvalidDuration(int months)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Create(DateTimeOffset.UtcNow, months));
    }
}
