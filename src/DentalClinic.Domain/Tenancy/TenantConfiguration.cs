using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed class TenantConfiguration : TenantOwnedEntity
{
    private TenantConfiguration() { }

    public TenantConfiguration(
        string culture,
        string timeZone,
        string currency,
        bool publicBookingEnabled = false,
        int publicBookingHorizonDays = 30,
        bool publicPriceVisibility = true)
    {
        Culture = culture;
        TimeZone = timeZone;
        Currency = currency;
        PublicBookingEnabled = publicBookingEnabled;
        PublicBookingHorizonDays = Math.Clamp(publicBookingHorizonDays, 1, 365);
        PublicPriceVisibility = publicPriceVisibility;
    }

    public static TenantConfiguration CreateForTenant(
        Guid tenantId,
        string culture,
        string timeZone,
        string currency,
        bool publicBookingEnabled = false,
        int publicBookingHorizonDays = 30,
        bool publicPriceVisibility = true)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        }

        return new TenantConfiguration(
            culture,
            timeZone,
            currency,
            publicBookingEnabled,
            publicBookingHorizonDays,
            publicPriceVisibility)
        { TenantId = tenantId };
    }

    public string Culture { get; private set; } = "en";
    public string TimeZone { get; private set; } = "UTC";
    public string Currency { get; private set; } = "USD";
    public bool PublicBookingEnabled { get; private set; }
    public int PublicBookingHorizonDays { get; private set; } = 30;
    public bool PublicPriceVisibility { get; private set; } = true;

    public void UpdatePublicBookingSettings(bool enabled, int horizonDays, bool priceVisibility)
    {
        PublicBookingEnabled = enabled;
        PublicBookingHorizonDays = Math.Clamp(horizonDays, 1, 365);
        PublicPriceVisibility = priceVisibility;
    }
}
