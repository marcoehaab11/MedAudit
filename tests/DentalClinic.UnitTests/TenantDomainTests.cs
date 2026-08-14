using DentalClinic.Domain.Tenancy;

namespace DentalClinic.UnitTests;

public sealed class TenantDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void NewTenantIsActiveAndNormalizesValues()
    {
        var tenant = CreateTenant("  Bright Smile  ", "bright-smile");

        Assert.Equal("Bright Smile", tenant.Name);
        Assert.Equal("bright-smile", tenant.Slug);
        Assert.Equal("USD", tenant.Currency);
        Assert.Equal(TenantStatus.Active, tenant.Status);
        Assert.Equal(Now, tenant.CreatedAt);
        Assert.Equal(Now, tenant.UpdatedAt);
    }

    [Fact]
    public void StatusTransitionsUpdateTimestamp()
    {
        var tenant = CreateTenant("Bright Smile", "bright-smile");
        var changedAt = Now.AddMinutes(5);

        tenant.Suspend(changedAt);

        Assert.Equal(TenantStatus.Suspended, tenant.Status);
        Assert.Equal(changedAt, tenant.UpdatedAt);
    }

    [Fact]
    public void InvalidSlugIsRejected() =>
        Assert.Throws<ArgumentException>(() => CreateTenant("Bright Smile", "Bright Smile"));

    private static Tenant CreateTenant(string name, string slug) =>
        new(name, slug, "+1 555 0100", "clinic@example.com", "1 Main Street", "Boston",
            "United States", "UTC", "usd", Now);
}
