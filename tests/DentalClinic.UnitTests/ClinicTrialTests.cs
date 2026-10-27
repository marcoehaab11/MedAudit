using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.UnitTests;

public sealed class ClinicTrialTests
{
    [Fact]
    public void VerifiedTrialRunsForExactlyFifteenDaysAndCannotRestart()
    {
        var created = DateTimeOffset.UtcNow;
        var confirmed = created.AddDays(3);
        var clinic = Create(created);
        clinic.StartVerifiedTrial(confirmed, true);
        Assert.Equal(confirmed, clinic.SubscriptionStartsAt);
        Assert.Equal(confirmed.AddDays(15), clinic.SubscriptionExpiresAt);
        Assert.False(clinic.HasActiveSubscription(confirmed.AddDays(15)));
        Assert.True(clinic.IsTrial);
        Assert.False(clinic.ShowcasePublished);
        Assert.Throws<InvalidOperationException>(() => clinic.StartVerifiedTrial(confirmed.AddDays(1), true));
        Assert.Equal(confirmed.AddDays(15), clinic.SubscriptionExpiresAt);
    }

    [Fact]
    public void SubscriptionExtensionConvertsTrialAndPublicationRequiresConsent()
    {
        var now = DateTimeOffset.UtcNow;
        var clinic = Create(now);
        clinic.StartVerifiedTrial(now, false);
        Assert.Throws<ArgumentException>(() => clinic.SetShowcase(false, true, 0));
        clinic.SetShowcase(true, true, 1);
        Assert.True(clinic.ShowcasePublished);
        clinic.SetShowcase(false, false, 1);
        Assert.False(clinic.ShowcaseConsent);
        clinic.ExtendSubscription(1, now.AddDays(16));
        Assert.False(clinic.IsTrial);
        Assert.True(clinic.HasActiveSubscription(now.AddDays(16)));
    }

    [Theory]
    [InlineData("PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+")]
    [InlineData("not-base64")]
    public void ActiveOrInvalidLogoContentIsRejected(string content) =>
        Assert.Throws<FluentValidation.ValidationException>(() => ClinicOnboardingService.DecodeLogo(content));

    private static Tenant Create(DateTimeOffset now) => new("Clinic", "clinic", "123", "owner@example.com", "Address", "Cairo", "Egypt", "Africa/Cairo", "EGP", now);
}
