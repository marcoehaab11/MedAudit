using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed class PatientMedication : TenantOwnedEntity
{
    private PatientMedication() { }
    public PatientMedication(Guid tenantId, Guid patientId, string name, string? dosage, string? notes, DateTimeOffset createdAt)
    { SetOwner(tenantId, patientId); Name = PatientField.Required(name, nameof(name), 200); Dosage = PatientField.Optional(dosage, nameof(dosage), 200); Notes = PatientField.Optional(notes, nameof(notes), 1000); CreatedAt = createdAt; UpdatedAt = createdAt; }
    public Guid PatientId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Dosage { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public void Update(string name, string? dosage, string? notes, DateTimeOffset updatedAt)
    { Name = PatientField.Required(name, nameof(name), 200); Dosage = PatientField.Optional(dosage, nameof(dosage), 200); Notes = PatientField.Optional(notes, nameof(notes), 1000); UpdatedAt = updatedAt; }
    private void SetOwner(Guid tenantId, Guid patientId)
    { if (tenantId == Guid.Empty || patientId == Guid.Empty) throw new ArgumentException("Tenant and patient IDs are required."); TenantId = tenantId; PatientId = patientId; }
}
