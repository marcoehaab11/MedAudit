using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Treatments;

public sealed class TreatmentCatalogItem : TenantOwnedEntity
{
    private TreatmentCatalogItem() { }
    public TreatmentCatalogItem(Guid tenantId, TreatmentType type, string name, string code, string? description,
        decimal defaultPrice, DateTimeOffset createdAt, bool isPublicBookingEnabled = true, int durationMinutes = 30)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        TenantId = tenantId;
        Apply(type, name, code, description, defaultPrice, durationMinutes);
        IsPublicBookingEnabled = isPublicBookingEnabled;
        IsActive = true; CreatedAt = createdAt; UpdatedAt = createdAt;
    }
    public TreatmentType Type { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public decimal DefaultPrice { get; private set; }
    public int DurationMinutes { get; private set; } = 30;
    public bool IsPublicBookingEnabled { get; private set; } = true;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(TreatmentType type, string name, string code, string? description, decimal defaultPrice,
        bool isActive, DateTimeOffset now, bool isPublicBookingEnabled = true, int durationMinutes = 30)
    {
        Apply(type, name, code, description, defaultPrice, durationMinutes);
        IsPublicBookingEnabled = isPublicBookingEnabled;
        IsActive = isActive;
        UpdatedAt = now;
    }

    private void Apply(TreatmentType type, string name, string code, string? description, decimal price, int duration)
    {
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        if (duration is < 5 or > 480) throw new ArgumentOutOfRangeException(nameof(duration));
        Type = type; Name = TreatmentRules.Required(name, nameof(name), 200);
        Code = TreatmentRules.Required(code, nameof(code), 50).ToUpperInvariant();
        Description = TreatmentRules.Optional(description, nameof(description), 1000);
        DefaultPrice = TreatmentRules.Money(price, nameof(price));
        DurationMinutes = duration;
    }
}

internal static class TreatmentRules
{
    public static decimal Money(decimal value, string parameter)
    {
        if (value < 0 || value > 1_000_000_000m || decimal.Round(value, 2) != value)
            throw new ArgumentOutOfRangeException(parameter, "Money must be non-negative with at most two decimals.");
        return value;
    }
    public static string Required(string value, string parameter, int maximum)
    { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameter); var result = value.Trim(); return result.Length <= maximum ? result : throw new ArgumentException($"Value cannot exceed {maximum} characters.", parameter); }
    public static string? Optional(string? value, string parameter, int maximum) => string.IsNullOrWhiteSpace(value) ? null : Required(value, parameter, maximum);
}
