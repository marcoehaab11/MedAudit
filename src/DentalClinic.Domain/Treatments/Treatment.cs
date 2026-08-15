using DentalClinic.Domain.Common;
using DentalClinic.Domain.Dental;

namespace DentalClinic.Domain.Treatments;

public sealed class Treatment : TenantOwnedEntity
{
    private readonly List<TreatmentTooth> teeth = [];
    private Treatment() { }
    public Treatment(Guid tenantId, Guid patientId, Guid doctorProfileId, Guid? appointmentId,
        Guid? treatmentPlanId, Guid? treatmentPlanItemId, Guid catalogItemId, Guid? sourceDentalProcedureId,
        TreatmentType type, string treatmentName, IEnumerable<int> toothNumbers, decimal price, string? notes,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty || catalogItemId == Guid.Empty)
            throw new ArgumentException("Tenant, patient, doctor, and catalog IDs are required.");
        TenantId = tenantId; PatientId = patientId; DoctorProfileId = doctorProfileId; AppointmentId = appointmentId;
        TreatmentPlanId = treatmentPlanId; TreatmentPlanItemId = treatmentPlanItemId; TreatmentCatalogItemId = catalogItemId;
        SourceDentalProcedureId = sourceDentalProcedureId; Type = type; TreatmentName = TreatmentRules.Required(treatmentName, nameof(treatmentName), 200);
        Price = TreatmentRules.Money(price, nameof(price)); Notes = TreatmentRules.Optional(notes, nameof(notes), 4000);
        foreach (var number in toothNumbers.Distinct()) { PermanentToothCatalog.Get(number); teeth.Add(new TreatmentTooth(tenantId, Id, number)); }
        Status = appointmentId.HasValue ? TreatmentStatus.Scheduled : TreatmentStatus.Planned;
        CreatedAt = createdAt; UpdatedAt = createdAt; Version = Guid.NewGuid();
    }
    public Guid PatientId { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public Guid? AppointmentId { get; private set; }
    public Guid? TreatmentPlanId { get; private set; }
    public Guid? TreatmentPlanItemId { get; private set; }
    public Guid TreatmentCatalogItemId { get; private set; }
    public Guid? SourceDentalProcedureId { get; private set; }
    public TreatmentType Type { get; private set; }
    public string TreatmentName { get; private set; } = string.Empty;
    public TreatmentStatus Status { get; private set; }
    public decimal Price { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid Version { get; private set; }
    public IReadOnlyCollection<TreatmentTooth> Teeth => teeth;
    public void UpdateNotes(string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); EnsureMutable(); Notes = TreatmentRules.Optional(notes, nameof(notes), 4000); Touch(now); }
    public void Start(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status is not (TreatmentStatus.Planned or TreatmentStatus.Scheduled)) throw new TreatmentStateException("Only planned or scheduled treatment can start."); Status = TreatmentStatus.InProgress; StartedAt = now; Touch(now); }
    public void Complete(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status != TreatmentStatus.InProgress) throw new TreatmentStateException("Treatment must be in progress."); Status = TreatmentStatus.Completed; CompletedAt = now; Touch(now); }
    public void Cancel(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status is TreatmentStatus.Completed or TreatmentStatus.Cancelled) throw new TreatmentStateException("This treatment cannot be cancelled."); Status = TreatmentStatus.Cancelled; Touch(now); }
    private void EnsureMutable() { if (Status == TreatmentStatus.Completed) throw new TreatmentStateException("Completed treatments are immutable."); }
    private void EnsureVersion(Guid version) { if (version == Guid.Empty || version != Version) throw new TreatmentConcurrencyException("The treatment changed. Reload it before continuing."); }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
}

public sealed class TreatmentTooth : TenantOwnedEntity
{
    private TreatmentTooth() { }
    internal TreatmentTooth(Guid tenantId, Guid treatmentId, int toothNumber)
    { TenantId = tenantId; TreatmentId = treatmentId; ToothNumber = PermanentToothCatalog.Get(toothNumber).Number; ToothId = PermanentToothCatalog.Get(toothNumber).Id; }
    public Guid TreatmentId { get; private set; }
    public Guid ToothId { get; private set; }
    public int ToothNumber { get; private set; }
}
