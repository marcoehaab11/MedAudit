using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Finance;

public sealed class FinancialCategory : TenantOwnedEntity
{
    private FinancialCategory() { }
    public FinancialCategory(Guid tenantId, string name, string code, FinancialCategoryType type, Guid? parentId, DateTimeOffset now)
    {
        if (tenantId == Guid.Empty || !Enum.IsDefined(type)) throw new ArgumentException("Tenant and category type are required.");
        TenantId = tenantId; Apply(name, code, type, parentId); IsActive = true; CreatedAt = now; UpdatedAt = now; Version = Guid.NewGuid();
    }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public FinancialCategoryType Type { get; private set; }
    public Guid? ParentId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid Version { get; private set; }
    public void Update(string name, string code, FinancialCategoryType type, Guid? parentId, Guid version, DateTimeOffset now)
    { EnsureVersion(version); Apply(name, code, type, parentId); Touch(now); }
    public void SetActive(bool active, Guid version, DateTimeOffset now) { EnsureVersion(version); IsActive = active; Touch(now); }
    private void Apply(string name, string code, FinancialCategoryType type, Guid? parentId)
    { if (!Enum.IsDefined(type) || parentId == Id) throw new ArgumentException("Invalid category hierarchy or type."); Name = FinanceRules.Required(name, nameof(name), 150); Code = FinanceRules.Required(code, nameof(code), 50).ToUpperInvariant(); Type = type; ParentId = parentId; }
    private void EnsureVersion(Guid value) { if (value == Guid.Empty || value != Version) throw new FinanceConcurrencyException("The category changed. Reload it before continuing."); }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
}
