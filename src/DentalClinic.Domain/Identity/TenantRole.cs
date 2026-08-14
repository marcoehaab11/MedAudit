using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class TenantRole : TenantOwnedEntity
{
    private TenantRole() { }

    public TenantRole(
        Guid tenantId,
        string name,
        string description,
        bool isSystemRole,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        }

        TenantId = tenantId;
        Name = Required(name, nameof(name), 100);
        NormalizedName = Name.ToUpperInvariant();
        Description = Required(description, nameof(description), 500);
        IsSystemRole = isSystemRole;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public bool IsSystemRole { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string name, string description, DateTimeOffset updatedAt)
    {
        if (IsSystemRole && !string.Equals(Name, name.Trim(), StringComparison.Ordinal))
        {
            throw new InvalidOperationException("System roles cannot be renamed.");
        }

        Name = Required(name, nameof(name), 100);
        NormalizedName = Name.ToUpperInvariant();
        Description = Required(description, nameof(description), 500);
        UpdatedAt = updatedAt;
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
}
