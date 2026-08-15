using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Inventory;

public sealed class InventoryCategory : TenantOwnedEntity
{
    private InventoryCategory() { }

    public InventoryCategory(
        Guid tenantId,
        string name,
        string? arabicName,
        string? description,
        bool isActive,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Category name is required.", nameof(name));

        TenantId = tenantId;
        Name = name.Trim();
        ArabicName = arabicName?.Trim();
        Description = description?.Trim();
        IsActive = isActive;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string? ArabicName { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string name, string? arabicName, string? description, bool isActive, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Category name is required.", nameof(name));

        Name = name.Trim();
        ArabicName = arabicName?.Trim();
        Description = description?.Trim();
        IsActive = isActive;
        UpdatedAt = now;
    }
}
