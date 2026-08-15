using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Inventory;

public sealed class Supplier : TenantOwnedEntity
{
    private Supplier() { }

    public Supplier(
        Guid tenantId,
        string name,
        string? contactPerson,
        string? phone,
        string? email,
        string? address,
        string? notes,
        bool isActive,
        DateTimeOffset createdAt
    )
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Supplier name is required.", nameof(name));

        TenantId = tenantId;
        Name = name.Trim();
        ContactPerson = contactPerson?.Trim();
        Phone = phone?.Trim();
        Email = email?.Trim();
        Address = address?.Trim();
        Notes = notes?.Trim();
        IsActive = isActive;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string? ContactPerson { get; private set; }
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Address { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(
        string name,
        string? contactPerson,
        string? phone,
        string? email,
        string? address,
        string? notes,
        bool isActive,
        DateTimeOffset now
    )
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Supplier name is required.", nameof(name));

        Name = name.Trim();
        ContactPerson = contactPerson?.Trim();
        Phone = phone?.Trim();
        Email = email?.Trim();
        Address = address?.Trim();
        Notes = notes?.Trim();
        IsActive = isActive;
        UpdatedAt = now;
    }
}
