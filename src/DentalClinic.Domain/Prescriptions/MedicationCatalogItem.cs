using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Prescriptions;

public sealed class MedicationCatalogItem : TenantOwnedEntity
{
    private MedicationCatalogItem() { }
    public MedicationCatalogItem(Guid tenantId, string name, string? genericName, string? strength,
        MedicationForm? form, string? notes, DateTimeOffset now)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        TenantId = tenantId; Apply(name, genericName, strength, form, notes); IsActive = true; CreatedAt = now; UpdatedAt = now;
    }
    public string Name { get; private set; } = string.Empty;
    public string? GenericName { get; private set; }
    public string? Strength { get; private set; }
    public MedicationForm? Form { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public void Update(string name, string? genericName, string? strength, MedicationForm? form, string? notes, bool active, DateTimeOffset now)
    { Apply(name, genericName, strength, form, notes); IsActive = active; UpdatedAt = now; }
    private void Apply(string name, string? genericName, string? strength, MedicationForm? form, string? notes)
    {
        if (form.HasValue && !Enum.IsDefined(form.Value)) throw new ArgumentOutOfRangeException(nameof(form));
        Name = PrescriptionRules.Required(name, nameof(name), 200); GenericName = PrescriptionRules.Optional(genericName, nameof(genericName), 200);
        Strength = PrescriptionRules.Optional(strength, nameof(strength), 100); Form = form; Notes = PrescriptionRules.Optional(notes, nameof(notes), 1000);
    }
}

internal static class PrescriptionRules
{
    public static string Required(string value, string parameter, int max)
    { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameter); var result = value.Trim(); return result.Length <= max ? result : throw new ArgumentException($"Value cannot exceed {max} characters.", parameter); }
    public static string? Optional(string? value, string parameter, int max) => string.IsNullOrWhiteSpace(value) ? null : Required(value, parameter, max);
}
