using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed class PatientBranchTransfer : TenantOwnedEntity
{
    private PatientBranchTransfer() { }

    public PatientBranchTransfer(Guid targetTenantId, Guid sourceTenantId, Guid sourcePatientId,
        Guid targetPatientId, Guid transferredBy, string clinicalSnapshotJson, DateTimeOffset transferredAt)
    {
        if (targetTenantId == Guid.Empty || sourceTenantId == Guid.Empty || sourcePatientId == Guid.Empty ||
            targetPatientId == Guid.Empty || transferredBy == Guid.Empty || targetTenantId == sourceTenantId)
            throw new ArgumentException("A patient transfer needs different source and target branches.");
        TenantId = targetTenantId;
        SourceTenantId = sourceTenantId;
        SourcePatientId = sourcePatientId;
        TargetPatientId = targetPatientId;
        TransferredBy = transferredBy;
        ClinicalSnapshotJson = string.IsNullOrWhiteSpace(clinicalSnapshotJson)
            ? throw new ArgumentException("Clinical history is required.", nameof(clinicalSnapshotJson))
            : clinicalSnapshotJson;
        TransferredAt = transferredAt;
    }

    public Guid SourceTenantId { get; private set; }
    public Guid SourcePatientId { get; private set; }
    public Guid TargetPatientId { get; private set; }
    public Guid TransferredBy { get; private set; }
    public string ClinicalSnapshotJson { get; private set; } = string.Empty;
    public DateTimeOffset TransferredAt { get; private set; }
}
