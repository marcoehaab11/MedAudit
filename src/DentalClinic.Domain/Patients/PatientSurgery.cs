using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed class PatientSurgery : TenantOwnedEntity
{
    private PatientSurgery() { }
    public PatientSurgery(Guid tenantId, Guid patientId, string procedure, DateOnly? procedureDate, string? notes, DateTimeOffset createdAt)
    { SetOwner(tenantId, patientId); Procedure = PatientField.Required(procedure, nameof(procedure), 300); ProcedureDate = procedureDate; Notes = PatientField.Optional(notes, nameof(notes), 1000); CreatedAt = createdAt; UpdatedAt = createdAt; }
    public Guid PatientId { get; private set; }
    public string Procedure { get; private set; } = string.Empty;
    public DateOnly? ProcedureDate { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public void Update(string procedure, DateOnly? procedureDate, string? notes, DateTimeOffset updatedAt)
    { Procedure = PatientField.Required(procedure, nameof(procedure), 300); ProcedureDate = procedureDate; Notes = PatientField.Optional(notes, nameof(notes), 1000); UpdatedAt = updatedAt; }
    private void SetOwner(Guid tenantId, Guid patientId)
    { if (tenantId == Guid.Empty || patientId == Guid.Empty) throw new ArgumentException("Tenant and patient IDs are required."); TenantId = tenantId; PatientId = patientId; }
}
