using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Prescriptions;

public sealed class Prescription : TenantOwnedEntity
{
    private readonly List<PrescriptionItem> items = [];
    private Prescription() { }
    public Prescription(Guid tenantId, Guid patientId, Guid doctorProfileId, Guid? appointmentId, Guid? examinationId,
        Guid? treatmentId, string prescriptionNumber, string? notes, Guid createdBy, DateTimeOffset now)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty || createdBy == Guid.Empty) throw new ArgumentException("Tenant, patient, doctor, and creator are required.");
        TenantId = tenantId; PatientId = patientId; DoctorProfileId = doctorProfileId; AppointmentId = appointmentId;
        ExaminationId = examinationId; TreatmentId = treatmentId; PrescriptionNumber = PrescriptionRules.Required(prescriptionNumber, nameof(prescriptionNumber), 30);
        Notes = PrescriptionRules.Optional(notes, nameof(notes), 4000); CreatedBy = createdBy; Status = PrescriptionStatus.Draft;
        CreatedAt = now; UpdatedAt = now; Version = Guid.NewGuid();
    }
    public Guid PatientId { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public Guid? AppointmentId { get; private set; }
    public Guid? ExaminationId { get; private set; }
    public Guid? TreatmentId { get; private set; }
    public string PrescriptionNumber { get; private set; } = string.Empty;
    public PrescriptionStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? IssuedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public Guid? IssuedBy { get; private set; }
    public string? DocumentReference { get; private set; }
    public Guid Version { get; private set; }
    public IReadOnlyCollection<PrescriptionItem> Items => items;
    public void UpdateContext(Guid patientId, Guid doctorProfileId, Guid? appointmentId, Guid? examinationId,
        Guid? treatmentId, string? notes, Guid version, DateTimeOffset now)
    { EnsureDraft(version); if (patientId == Guid.Empty || doctorProfileId == Guid.Empty) throw new ArgumentException("Patient and doctor are required."); PatientId = patientId; DoctorProfileId = doctorProfileId; AppointmentId = appointmentId; ExaminationId = examinationId; TreatmentId = treatmentId; Notes = PrescriptionRules.Optional(notes, nameof(notes), 4000); Touch(now); }
    public void Update(string? notes, Guid version, DateTimeOffset now) { EnsureDraft(version); Notes = PrescriptionRules.Optional(notes, nameof(notes), 4000); Touch(now); }
    public PrescriptionItem AddItem(Guid? medicationId, string name, string? generic, string? strength, MedicationForm? form,
        string dose, string frequency, string duration, string? route, string instructions, int? quantity, int sortOrder, Guid version, DateTimeOffset now)
    { EnsureDraft(version); var item = new PrescriptionItem(TenantId, Id, medicationId, name, generic, strength, form, dose, frequency, duration, route, instructions, quantity, sortOrder, now); items.Add(item); NormalizeOrder(); Touch(now); return item; }
    public void UpdateItem(Guid id, string dose, string frequency, string duration, string? route, string instructions, int? quantity, int sortOrder, Guid version, DateTimeOffset now)
    { EnsureDraft(version); Find(id).Update(dose, frequency, duration, route, instructions, quantity, sortOrder); NormalizeOrder(); Touch(now); }
    public void RemoveItem(Guid id, Guid version, DateTimeOffset now) { EnsureDraft(version); items.Remove(Find(id)); NormalizeOrder(); Touch(now); }
    public void Issue(Guid issuedBy, string documentReference, Guid version, DateTimeOffset now)
    { EnsureDraft(version); if (items.Count == 0) throw new PrescriptionStateException("A prescription needs at least one medication before issuing."); if (issuedBy == Guid.Empty) throw new ArgumentException("Issuer is required."); DocumentReference = PrescriptionRules.Required(documentReference, nameof(documentReference), 100); IssuedBy = issuedBy; IssuedAt = now; Status = PrescriptionStatus.Issued; Touch(now); }
    public void Cancel(Guid version, DateTimeOffset now)
    { EnsureVersion(version); if (Status == PrescriptionStatus.Cancelled) throw new PrescriptionStateException("Prescription is already cancelled."); Status = PrescriptionStatus.Cancelled; CancelledAt = now; Touch(now); }
    private PrescriptionItem Find(Guid id) => items.SingleOrDefault(x => x.Id == id) ?? throw new KeyNotFoundException("Prescription item was not found.");
    private void EnsureDraft(Guid version) { EnsureVersion(version); if (Status != PrescriptionStatus.Draft) throw new PrescriptionStateException("Only draft prescriptions can be edited."); }
    private void EnsureVersion(Guid version) { if (version == Guid.Empty || version != Version) throw new PrescriptionConcurrencyException("The prescription changed. Reload it before continuing."); }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
    private void NormalizeOrder() { var order = 1; foreach (var item in items.OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt)) item.SetSortOrder(order++); }
}

public sealed class PrescriptionItem : TenantOwnedEntity
{
    private PrescriptionItem() { }
    internal PrescriptionItem(Guid tenantId, Guid prescriptionId, Guid? medicationId, string name, string? generic, string? strength,
        MedicationForm? form, string dose, string frequency, string duration, string? route, string instructions, int? quantity, int sortOrder, DateTimeOffset now)
    {
        TenantId = tenantId; PrescriptionId = prescriptionId; MedicationId = medicationId; MedicationNameSnapshot = PrescriptionRules.Required(name, nameof(name), 200);
        GenericNameSnapshot = PrescriptionRules.Optional(generic, nameof(generic), 200); StrengthSnapshot = PrescriptionRules.Optional(strength, nameof(strength), 100);
        if (form.HasValue && !Enum.IsDefined(form.Value)) throw new ArgumentOutOfRangeException(nameof(form)); FormSnapshot = form; CreatedAt = now;
        Update(dose, frequency, duration, route, instructions, quantity, sortOrder);
    }
    public Guid PrescriptionId { get; private set; }
    public Guid? MedicationId { get; private set; }
    public string MedicationNameSnapshot { get; private set; } = string.Empty;
    public string? GenericNameSnapshot { get; private set; }
    public string? StrengthSnapshot { get; private set; }
    public MedicationForm? FormSnapshot { get; private set; }
    public string Dose { get; private set; } = string.Empty;
    public string Frequency { get; private set; } = string.Empty;
    public string Duration { get; private set; } = string.Empty;
    public string? Route { get; private set; }
    public string Instructions { get; private set; } = string.Empty;
    public int? Quantity { get; private set; }
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    internal void Update(string dose, string frequency, string duration, string? route, string instructions, int? quantity, int sortOrder)
    { Dose = PrescriptionRules.Required(dose, nameof(dose), 100); Frequency = PrescriptionRules.Required(frequency, nameof(frequency), 200); Duration = PrescriptionRules.Required(duration, nameof(duration), 100); Route = PrescriptionRules.Optional(route, nameof(route), 100); Instructions = PrescriptionRules.Required(instructions, nameof(instructions), 1000); if (quantity is <= 0 or > 10000) throw new ArgumentOutOfRangeException(nameof(quantity)); Quantity = quantity; if (sortOrder is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(sortOrder)); SortOrder = sortOrder; }
    internal void SetSortOrder(int value) => SortOrder = value;
}

public sealed class PrescriptionNumberSequence : TenantOwnedEntity
{
    private PrescriptionNumberSequence() { }
    public long LastValue { get; private set; }
}
