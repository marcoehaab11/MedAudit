using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed class TenantConfiguration : TenantOwnedEntity
{
    private TenantConfiguration() { }

    public TenantConfiguration(string culture, string timeZone, string currency)
    {
        Culture = culture;
        TimeZone = timeZone;
        Currency = currency;
    }

    public static TenantConfiguration CreateForTenant(
        Guid tenantId,
        string culture,
        string timeZone,
        string currency)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        }

        return new TenantConfiguration(culture, timeZone, currency) { TenantId = tenantId };
    }

    public string Culture { get; private set; } = "en";
    public string TimeZone { get; private set; } = "UTC";
    public string Currency { get; private set; } = "USD";
}
