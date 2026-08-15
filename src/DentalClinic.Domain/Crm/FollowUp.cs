using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Crm;

public sealed class FollowUp : TenantOwnedEntity
{
    private FollowUp() { }

    public FollowUp(Guid tenantId, Guid patientId, Guid assignedToUserId, Guid createdByUserId,
        FollowUpType type, DateTimeOffset dueAt, string title, string? notes, Guid? relatedAppointmentId,
        Guid? relatedTreatmentPlanId, Guid? relatedTreatmentId, Guid? relatedPrescriptionId, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || assignedToUserId == Guid.Empty || createdByUserId == Guid.Empty)
            throw new ArgumentException("Tenant, patient, assignee, and creator are required.");
        TenantId = tenantId; PatientId = patientId; AssignedToUserId = assignedToUserId; CreatedByUserId = createdByUserId;
        Apply(type, dueAt, title, notes, relatedAppointmentId, relatedTreatmentPlanId, relatedTreatmentId, relatedPrescriptionId);
        Status = FollowUpStatus.Pending; CreatedAt = createdAt; UpdatedAt = createdAt; Version = Guid.NewGuid();
    }

    public Guid PatientId { get; private set; }
    public Guid AssignedToUserId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public FollowUpType Type { get; private set; }
    public FollowUpStatus Status { get; private set; }
    public DateTimeOffset DueAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public Guid? RelatedAppointmentId { get; private set; }
    public Guid? RelatedTreatmentPlanId { get; private set; }
    public Guid? RelatedTreatmentId { get; private set; }
    public Guid? RelatedPrescriptionId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid Version { get; private set; }
    public bool IsTerminal => Status is FollowUpStatus.Completed or FollowUpStatus.Cancelled;
    public bool IsOverdue(DateTimeOffset now) => !IsTerminal && DueAt < now;

    public void Update(FollowUpType type, DateTimeOffset dueAt, string title, string? notes,
        Guid? appointmentId, Guid? planId, Guid? treatmentId, Guid? prescriptionId, Guid version, DateTimeOffset now)
    {
        EnsureEditable(version); Apply(type, dueAt, title, notes, appointmentId, planId, treatmentId, prescriptionId); Touch(now);
    }

    public void Assign(Guid userId, Guid version, DateTimeOffset now)
    {
        EnsureEditable(version); if (userId == Guid.Empty) throw new ArgumentException("Assignee is required.", nameof(userId));
        AssignedToUserId = userId; Touch(now);
    }

    public void Start(Guid version, DateTimeOffset now)
    { EnsureVersion(version); if (Status != FollowUpStatus.Pending) throw new FollowUpStateException("Only pending follow-ups can be started."); Status = FollowUpStatus.InProgress; Touch(now); }
    public void Complete(Guid version, DateTimeOffset now)
    { EnsureVersion(version); if (Status is not (FollowUpStatus.Pending or FollowUpStatus.InProgress)) throw new FollowUpStateException("Only open follow-ups can be completed."); Status = FollowUpStatus.Completed; CompletedAt = now; Touch(now); }
    public void Cancel(Guid version, DateTimeOffset now)
    { EnsureVersion(version); if (IsTerminal) throw new FollowUpStateException("Terminal follow-ups cannot be changed."); Status = FollowUpStatus.Cancelled; CancelledAt = now; Touch(now); }

    private void Apply(FollowUpType type, DateTimeOffset dueAt, string title, string? notes, Guid? appointmentId,
        Guid? planId, Guid? treatmentId, Guid? prescriptionId)
    {
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        if (dueAt.Offset != TimeSpan.Zero) throw new ArgumentException("Due time must be UTC.", nameof(dueAt));
        Type = type; DueAt = dueAt; Title = Required(title, nameof(title), 200); Notes = Optional(notes, nameof(notes), 2000);
        RelatedAppointmentId = NonEmpty(appointmentId); RelatedTreatmentPlanId = NonEmpty(planId);
        RelatedTreatmentId = NonEmpty(treatmentId); RelatedPrescriptionId = NonEmpty(prescriptionId);
    }

    private void EnsureEditable(Guid version) { EnsureVersion(version); if (IsTerminal) throw new FollowUpStateException("Terminal follow-ups are immutable."); }
    private void EnsureVersion(Guid version) { if (version != Version) throw new FollowUpConcurrencyException("The follow-up changed. Reload it before continuing."); }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
    private static Guid? NonEmpty(Guid? id) => id == Guid.Empty ? throw new ArgumentException("Related IDs cannot be empty.") : id;
    private static string Required(string value, string name, int max) { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", name); var x = value.Trim(); return x.Length <= max ? x : throw new ArgumentException($"Value cannot exceed {max} characters.", name); }
    private static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Required(value, name, max);
}
