using System.Text.RegularExpressions;
using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed partial class Tenant : Entity
{
    private Tenant() { }

    public Tenant(
        string name,
        string slug,
        string phone,
        string email,
        string address,
        string city,
        string country,
        string timeZone,
        string currency,
        DateTimeOffset createdAt,
        string? logoReference = null)
    {
        Name = Required(name, nameof(name), 200);
        Slug = NormalizeSlug(slug);
        Phone = Required(phone, nameof(phone), 50);
        Email = Required(email, nameof(email), 256).ToLowerInvariant();
        Address = Required(address, nameof(address), 500);
        City = Required(city, nameof(city), 100);
        Country = Required(country, nameof(country), 100);
        TimeZone = Required(timeZone, nameof(timeZone), 100);
        Currency = Required(currency, nameof(currency), 3).ToUpperInvariant();
        LogoReference = Optional(logoReference, nameof(logoReference), 500);
        Status = TenantStatus.Active;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public string Country { get; private set; } = string.Empty;
    public string TimeZone { get; private set; } = string.Empty;
    public string Currency { get; private set; } = string.Empty;
    public string? LogoReference { get; private set; }
    public TenantStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(
        string name,
        string slug,
        string phone,
        string email,
        string address,
        string city,
        string country,
        string timeZone,
        string currency,
        DateTimeOffset updatedAt,
        string? logoReference = null)
    {
        Name = Required(name, nameof(name), 200);
        Slug = NormalizeSlug(slug);
        Phone = Required(phone, nameof(phone), 50);
        Email = Required(email, nameof(email), 256).ToLowerInvariant();
        Address = Required(address, nameof(address), 500);
        City = Required(city, nameof(city), 100);
        Country = Required(country, nameof(country), 100);
        TimeZone = Required(timeZone, nameof(timeZone), 100);
        Currency = Required(currency, nameof(currency), 3).ToUpperInvariant();
        LogoReference = Optional(logoReference, nameof(logoReference), 500);
        UpdatedAt = updatedAt;
    }

    public void Activate(DateTimeOffset updatedAt) => ChangeStatus(TenantStatus.Active, updatedAt);
    public void Deactivate(DateTimeOffset updatedAt) => ChangeStatus(TenantStatus.Inactive, updatedAt);
    public void Suspend(DateTimeOffset updatedAt) => ChangeStatus(TenantStatus.Suspended, updatedAt);

    private void ChangeStatus(TenantStatus status, DateTimeOffset updatedAt)
    {
        Status = status;
        UpdatedAt = updatedAt;
    }

    private static string NormalizeSlug(string value)
    {
        var slug = Required(value, nameof(value), 100).ToLowerInvariant();
        if (!SlugPattern().IsMatch(slug))
        {
            throw new ArgumentException(
                "Slug may contain lowercase letters, numbers, and single hyphens only.", nameof(value));
        }

        return slug;
    }

    private static string Required(string value, string parameterName, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value is required.", parameterName);
        }

        var normalized = value.Trim();
        return normalized.Length > maximumLength
            ? throw new ArgumentException($"Value cannot exceed {maximumLength} characters.", parameterName)
            : normalized;
    }

    private static string? Optional(string? value, string parameterName, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Required(value, parameterName, maximumLength);
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex SlugPattern();
}
