using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed class PatientMedicalCondition : TenantOwnedEntity
{
    private PatientMedicalCondition() { }
    public PatientMedicalCondition(Guid tenantId, Guid patientId, string name, string? notes, DateTimeOffset createdAt)
    { SetOwner(tenantId, patientId); Name = PatientField.Required(name, nameof(name), 200); Notes = PatientField.Optional(notes, nameof(notes), 1000); CreatedAt = createdAt; UpdatedAt = createdAt; }
    public Guid PatientId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public void Update(string name, string? notes, DateTimeOffset updatedAt)
    { Name = PatientField.Required(name, nameof(name), 200); Notes = PatientField.Optional(notes, nameof(notes), 1000); UpdatedAt = updatedAt; }
    private void SetOwner(Guid tenantId, Guid patientId)
    { if (tenantId == Guid.Empty || patientId == Guid.Empty) throw new ArgumentException("Tenant and patient IDs are required."); TenantId = tenantId; PatientId = patientId; }
}
