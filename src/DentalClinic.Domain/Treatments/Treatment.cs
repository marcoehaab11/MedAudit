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
        DateTimeOffset createdAt, bool priceConfirmed = true, Guid? executionId = null)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty || catalogItemId == Guid.Empty)
            throw new ArgumentException("Tenant, patient, doctor, and catalog IDs are required.");
        if (executionId == Guid.Empty) throw new ArgumentException("Execution ID must not be empty.", nameof(executionId));
        if (executionId.HasValue) Id = executionId.Value;
        TenantId = tenantId; PatientId = patientId; DoctorProfileId = doctorProfileId; AppointmentId = appointmentId;
        TreatmentPlanId = treatmentPlanId; TreatmentPlanItemId = treatmentPlanItemId; TreatmentCatalogItemId = catalogItemId;
        SourceDentalProcedureId = sourceDentalProcedureId; Type = type; TreatmentName = TreatmentRules.Required(treatmentName, nameof(treatmentName), 200);
        PriceConfirmed = priceConfirmed;
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
    public bool PriceConfirmed { get; private set; }
    public string? Notes { get; private set; }
    public string? ClinicalWorkflowJson { get; private set; }
    public string ExecutedStepsJson { get; private set; } = "[]";
    public void RecordFillingStep(string step, Guid appointmentId, DateTimeOffset now)
    {
        EnsureMutable();
        if (Type != TreatmentType.Filling || ParentTreatmentId.HasValue || Status == TreatmentStatus.Cancelled || appointmentId == Guid.Empty ||
            step is not ("caries-removal" or "temporary-filling")) throw new TreatmentStateException("Choose a performed filling step and a verified visit.");
        ExecutedStepsJson = ExecutedClinicalSteps.Append(ExecutedStepsJson, $"{appointmentId}:{step}", step, now, appointmentId);
        Touch(now);
    }
    public bool IsClinicalFlowContainer { get; private set; }
    public Guid? ParentTreatmentId { get; private set; }
    public string? FlowComponentKey { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public Guid Version { get; private set; }
    public IReadOnlyCollection<TreatmentTooth> Teeth => teeth;
    public void ConfirmPrice(decimal price, Guid expectedVersion, DateTimeOffset now)
    {
        EnsureVersion(expectedVersion);
        if (PriceConfirmed || Status == TreatmentStatus.Cancelled) throw new TreatmentStateException("The treatment price is already approved or cancelled.");
        Price = TreatmentRules.Money(price, nameof(price)); PriceConfirmed = true; Touch(now);
    }
    public void UpdateNotes(string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); EnsureMutable(); Notes = TreatmentRules.Optional(notes, nameof(notes), 4000); Touch(now); }
    public void Start(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status is not (TreatmentStatus.Planned or TreatmentStatus.Scheduled)) throw new TreatmentStateException("Only planned or scheduled treatment can start."); Status = TreatmentStatus.InProgress; StartedAt = now; Touch(now); }
    public void SaveClinicalWorkflow(string kind, string planJson, Guid visitId, Guid appointmentId, Guid doctorUserId,
        DateOnly visitDate, string visitJson, bool performed, Guid expectedVersion, DateTimeOffset now, string? approvedStep = null)
    {
        EnsureVersion(expectedVersion); EnsureMutable();
        if (Status == TreatmentStatus.Cancelled || Type != TreatmentType.Other) throw new TreatmentStateException("This treatment does not support a scaling or bleaching workflow.");
        var saved = ClinicalWorkflow.Save(ClinicalWorkflowJson, kind, planJson, visitId, appointmentId, DoctorProfileId, doctorUserId, visitDate, visitJson, performed, now);
        var history = ExecutedStepsJson;
        foreach (var step in ClinicalWorkflow.ExecutedOnAdvance(kind, visitJson, approvedStep))
            history = ExecutedClinicalSteps.Append(history, $"{visitId}:{step}", step, now, appointmentId);
        ClinicalWorkflowJson = saved; ExecutedStepsJson = history;
        Touch(now);
    }
    public void Complete(Guid expectedVersion, DateTimeOffset now, Guid? completionAppointmentId = null)
    {
        EnsureVersion(expectedVersion);
        if (ClinicalWorkflowJson is null && Type == TreatmentType.Other && "scal|polish|clean|whiten|bleach|تنظيف|تنضيف|جير|تبييض|تبيض".Split('|').Any(term => TreatmentName.Contains(term, StringComparison.OrdinalIgnoreCase)))
            throw new TreatmentStateException("Open and complete the scaling or bleaching workflow before completing this treatment.");
        if (IsClinicalFlowContainer)
        {
            if (ClinicalWorkflowJson is null || RootTreatmentFlow.NextStage(RootTreatmentFlow.Parse(ClinicalWorkflowJson)) != 6)
                throw new TreatmentStateException("Complete the remaining clinical steps first.");
        }
        else if (ClinicalWorkflowJson is not null) ClinicalWorkflow.EnsureComplete(ClinicalWorkflowJson);
        if (Type == TreatmentType.Filling && (Notes?.Split('·', StringSplitOptions.TrimEntries).Any(part => part.Equals("Filling material: Temporary", StringComparison.OrdinalIgnoreCase)) ?? false))
            throw new TreatmentStateException("Temporary filling is unfinished. Record the permanent filling before completing treatment.");
        if (Status is not (TreatmentStatus.InProgress or TreatmentStatus.Scheduled or TreatmentStatus.Planned)) throw new TreatmentStateException("Treatment must be planned, scheduled, or in progress.");
        if (completionAppointmentId.HasValue) { if (completionAppointmentId == Guid.Empty) throw new ArgumentException("A valid completion visit is required."); AppointmentId = completionAppointmentId; }
        if (StartedAt is null) StartedAt = now; Status = TreatmentStatus.Completed; CompletedAt = now;
        if (!IsClinicalFlowContainer && ClinicalWorkflowJson is null)
            ExecutedStepsJson = ExecutedClinicalSteps.Append(ExecutedStepsJson, "completed", "procedure-completed", now, AppointmentId);
        Touch(now);
    }
    public void RetractClinicalSession(Guid sessionId, Guid actor, string reason, Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); EnsureMutable(); if (Status == TreatmentStatus.Cancelled || ClinicalWorkflowJson is null) throw new TreatmentStateException("This treatment cannot be corrected."); ClinicalWorkflowJson = ClinicalWorkflow.Retract(ClinicalWorkflowJson, sessionId, actor, reason, now); Touch(now); }
    public void Cancel(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status is TreatmentStatus.Completed or TreatmentStatus.Cancelled) throw new TreatmentStateException("This treatment cannot be cancelled."); Status = TreatmentStatus.Cancelled; Touch(now); }
    public void SaveRootFlow(string json, Guid expectedVersion, DateTimeOffset now)
    {
        EnsureVersion(expectedVersion); EnsureMutable();
        if (Status == TreatmentStatus.Cancelled || ParentTreatmentId.HasValue || Type is not (TreatmentType.RootCanal or TreatmentType.Crown))
            throw new TreatmentStateException("This treatment cannot own a root/crown flow.");
        IsClinicalFlowContainer = true; ClinicalWorkflowJson = json; PriceConfirmed = true; Touch(now);
    }
    public void LinkFlowComponent(Guid parentId, string key)
    {
        if (parentId == Guid.Empty || ParentTreatmentId.HasValue || string.IsNullOrWhiteSpace(key) || key.Length > 100)
            throw new ArgumentException("A valid, permanent flow component link is required.");
        ParentTreatmentId = parentId; FlowComponentKey = key;
    }
    public void CompleteFlowComponent(Guid appointmentId, Guid expectedVersion, DateTimeOffset now, Guid? sourceDentalProcedureId = null)
    {
        if (!ParentTreatmentId.HasValue || appointmentId == Guid.Empty) throw new TreatmentStateException("A verified visit and parent treatment are required.");
        EnsureVersion(expectedVersion); EnsureMutable(); AppointmentId = appointmentId; SourceDentalProcedureId = sourceDentalProcedureId; Complete(expectedVersion, now);
    }
    public void ReplanFlowComponent(DateTimeOffset now)
    {
        if (!ParentTreatmentId.HasValue || Status != TreatmentStatus.Cancelled) throw new TreatmentStateException("Only an unperformed linked procedure can be replanned.");
        Status = TreatmentStatus.Planned; Touch(now);
    }
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
