using DentalClinic.Domain.Tenancy;
using Xunit;

namespace DentalClinic.UnitTests;

public class SettingsDomainTests
{
    [Fact]
    public void TenantConfigurationInitializesWithDefaultsAndValidatesInputs()
    {
        var config = TenantConfiguration.CreateForTenant(
            Guid.NewGuid(),
            "en",
            "UTC",
            "USD",
            true,
            60,
            true
        );

        Assert.Equal("en", config.Culture);
        Assert.Equal("UTC", config.TimeZone);
        Assert.Equal("USD", config.Currency);
        Assert.True(config.PublicBookingEnabled);
        Assert.Equal(60, config.PublicBookingHorizonDays);
        Assert.True(config.PublicPriceVisibility);
        Assert.NotEqual(Guid.Empty, config.Version);
    }

    [Fact]
    public void TenantConfigurationRejectsInvalidTimeZone()
    {
        Assert.Throws<ArgumentException>(() =>
            TenantConfiguration.CreateForTenant(Guid.NewGuid(), "en", "Invalid/TimeZone_999", "USD"));
    }

    [Fact]
    public void TenantConfigurationRejectsInvalidCurrencyCode()
    {
        Assert.Throws<ArgumentException>(() =>
            TenantConfiguration.CreateForTenant(Guid.NewGuid(), "en", "UTC", "US"));

        Assert.Throws<ArgumentException>(() =>
            TenantConfiguration.CreateForTenant(Guid.NewGuid(), "en", "UTC", "USDA"));
    }

    [Fact]
    public void TenantConfigurationRejectsInvalidHexColorFormat()
    {
        var config = TenantConfiguration.CreateForTenant(Guid.NewGuid(), "en", "UTC", "USD");
        var version = config.Version;

        Assert.Throws<ArgumentException>(() =>
            config.UpdateBranding("1e40af", "#0284c7", "#f59e0b", "en", "en,ar", false, version));
    }

    [Fact]
    public void TenantConfigurationStaleVersionTriggersOptimisticConcurrencyException()
    {
        var config = TenantConfiguration.CreateForTenant(Guid.NewGuid(), "en", "UTC", "USD");
        var staleVersion = Guid.NewGuid();

        Assert.Throws<InvalidOperationException>(() =>
            config.UpdateBranding("#1e40af", "#0284c7", "#f59e0b", "en", "en,ar", false, staleVersion));
    }

    [Fact]
    public void ClinicHourPeriodRejectsStartTimeAfterOrEqualEndTime()
    {
        var start = new TimeOnly(17, 0);
        var end = new TimeOnly(9, 0);

        Assert.Throws<ArgumentException>(() =>
            new ClinicHourPeriod(start, end, ClinicPeriodType.Work));
    }

    [Fact]
    public void ClinicHoursRejectsOverlappingPeriods()
    {
        var hours = new ClinicHours(Guid.NewGuid(), DayOfWeek.Monday, true);
        var p1 = new ClinicHourPeriod(new TimeOnly(9, 0), new TimeOnly(13, 0), ClinicPeriodType.Work);
        var p2 = new ClinicHourPeriod(new TimeOnly(12, 0), new TimeOnly(17, 0), ClinicPeriodType.Work);

        Assert.Throws<ArgumentException>(() => hours.SetPeriods([p1, p2]));
    }

    [Fact]
    public void ClinicHolidayRejectsStartDateAfterEndDate()
    {
        var tenantId = Guid.NewGuid();
        var start = new DateOnly(2026, 9, 10);
        var end = new DateOnly(2026, 9, 1);

        Assert.Throws<ArgumentException>(() =>
            new ClinicHoliday(tenantId, "National Holiday", null, start, end, null, null, null, true, DateTimeOffset.UtcNow));
    }
}
