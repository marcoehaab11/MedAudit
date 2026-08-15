using DentalClinic.Domain.Common;
using DentalClinic.Domain.Dental;

namespace DentalClinic.Domain.Treatments;

public sealed class TreatmentPlan : TenantOwnedEntity
{
    private readonly List<TreatmentPlanItem> items = [];
    private TreatmentPlan() { }
    public TreatmentPlan(Guid tenantId, Guid patientId, Guid doctorProfileId, string title, string? notes,
        decimal discountAmount, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty)
            throw new ArgumentException("Tenant, patient, and doctor IDs are required.");
        TenantId = tenantId; PatientId = patientId; DoctorProfileId = doctorProfileId;
        Title = TreatmentRules.Required(title, nameof(title), 250); Notes = TreatmentRules.Optional(notes, nameof(notes), 4000);
        DiscountAmount = TreatmentRules.Money(discountAmount, nameof(discountAmount));
        Status = TreatmentPlanStatus.Draft; CreatedAt = createdAt; UpdatedAt = createdAt; Version = Guid.NewGuid();
        Recalculate();
    }
    public Guid PatientId { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public TreatmentPlanStatus Status { get; private set; }
    public decimal Subtotal { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal Total { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ProposedAt { get; private set; }
    public DateTimeOffset? AcceptedAt { get; private set; }
    public DateTimeOffset? RejectedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public Guid Version { get; private set; }
    public IReadOnlyCollection<TreatmentPlanItem> Items => items;

    public void Update(string title, string? notes, decimal discountAmount, Guid expectedVersion, DateTimeOffset now)
    { EnsureDraft(expectedVersion); Title = TreatmentRules.Required(title, nameof(title), 250); Notes = TreatmentRules.Optional(notes, nameof(notes), 4000); DiscountAmount = TreatmentRules.Money(discountAmount, nameof(discountAmount)); Recalculate(); Touch(now); }
    public TreatmentPlanItem AddItem(Guid catalogItemId, TreatmentType type, string catalogName, int? toothNumber,
        int quantity, decimal catalogPrice, decimal itemDiscount, string? notes, Guid expectedVersion, DateTimeOffset now)
    { EnsureDraft(expectedVersion); var item = new TreatmentPlanItem(TenantId, Id, catalogItemId, type, catalogName, toothNumber, quantity, catalogPrice, itemDiscount, notes, now); items.Add(item); Recalculate(); Touch(now); return item; }
    public void UpdateItem(Guid itemId, int? toothNumber, int quantity, decimal itemDiscount, string? notes,
        Guid expectedVersion, DateTimeOffset now)
    { EnsureDraft(expectedVersion); FindItem(itemId).Update(toothNumber, quantity, itemDiscount, notes, now); Recalculate(); Touch(now); }
    public void RemoveItem(Guid itemId, Guid expectedVersion, DateTimeOffset now)
    { EnsureDraft(expectedVersion); items.Remove(FindItem(itemId)); Recalculate(); Touch(now); }
    public void Propose(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status != TreatmentPlanStatus.Draft || items.Count == 0) throw new TreatmentStateException("Only a non-empty draft plan can be proposed."); Status = TreatmentPlanStatus.Proposed; ProposedAt = now; Touch(now); }
    public void Accept(Guid expectedVersion, DateTimeOffset now)
    { Transition(TreatmentPlanStatus.Proposed, TreatmentPlanStatus.Accepted, expectedVersion, now); AcceptedAt = now; }
    public void Reject(Guid expectedVersion, DateTimeOffset now)
    { Transition(TreatmentPlanStatus.Proposed, TreatmentPlanStatus.Rejected, expectedVersion, now); RejectedAt = now; }
    public void Start(Guid expectedVersion, DateTimeOffset now) => Transition(TreatmentPlanStatus.Accepted, TreatmentPlanStatus.InProgress, expectedVersion, now);
    public void Complete(Guid expectedVersion, DateTimeOffset now)
    { Transition(TreatmentPlanStatus.InProgress, TreatmentPlanStatus.Completed, expectedVersion, now); CompletedAt = now; }
    public void Cancel(Guid expectedVersion, DateTimeOffset now)
    { EnsureVersion(expectedVersion); if (Status is not (TreatmentPlanStatus.Draft or TreatmentPlanStatus.Proposed or TreatmentPlanStatus.Accepted)) throw new TreatmentStateException("This plan cannot be cancelled in its current status."); Status = TreatmentPlanStatus.Cancelled; CancelledAt = now; Touch(now); }
    private void Transition(TreatmentPlanStatus from, TreatmentPlanStatus to, Guid version, DateTimeOffset now)
    { EnsureVersion(version); if (Status != from) throw new TreatmentStateException($"Treatment plan must be {from}."); Status = to; Touch(now); }
    private void EnsureDraft(Guid version) { EnsureVersion(version); if (Status != TreatmentPlanStatus.Draft) throw new TreatmentStateException("Only draft treatment plans can be edited."); }
    private void EnsureVersion(Guid version) { if (version == Guid.Empty || version != Version) throw new TreatmentConcurrencyException("The treatment plan changed. Reload it before continuing."); }
    private void Recalculate() { Subtotal = items.Sum(x => x.Total); if (DiscountAmount > Subtotal) throw new ArgumentOutOfRangeException(nameof(DiscountAmount), "Plan discount cannot exceed subtotal."); Total = Subtotal - DiscountAmount; }
    private void Touch(DateTimeOffset now) { UpdatedAt = now; Version = Guid.NewGuid(); }
    private TreatmentPlanItem FindItem(Guid id) => items.SingleOrDefault(x => x.Id == id) ?? throw new KeyNotFoundException("Treatment plan item was not found.");
}

public sealed class TreatmentPlanItem : TenantOwnedEntity
{
    private TreatmentPlanItem() { }
    internal TreatmentPlanItem(Guid tenantId, Guid planId, Guid catalogId, TreatmentType type, string catalogName,
        int? toothNumber, int quantity, decimal unitPrice, decimal discount, string? notes, DateTimeOffset now)
    {
        TenantId = tenantId; TreatmentPlanId = planId; TreatmentCatalogItemId = catalogId; TreatmentType = type;
        TreatmentName = TreatmentRules.Required(catalogName, nameof(catalogName), 200); UnitPrice = TreatmentRules.Money(unitPrice, nameof(unitPrice));
        CreatedAt = now; Apply(toothNumber, quantity, discount, notes, now);
    }
    public Guid TreatmentPlanId { get; private set; }
    public Guid TreatmentCatalogItemId { get; private set; }
    public TreatmentType TreatmentType { get; private set; }
    public string TreatmentName { get; private set; } = string.Empty;
    public int? ToothNumber { get; private set; }
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal Total { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    internal void Update(int? toothNumber, int quantity, decimal discount, string? notes, DateTimeOffset now) => Apply(toothNumber, quantity, discount, notes, now);
    private void Apply(int? toothNumber, int quantity, decimal discount, string? notes, DateTimeOffset now)
    {
        if (toothNumber.HasValue) PermanentToothCatalog.Get(toothNumber.Value);
        if (quantity is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(quantity));
        ToothNumber = toothNumber; Quantity = quantity; DiscountAmount = TreatmentRules.Money(discount, nameof(discount));
        var gross = UnitPrice * quantity; if (DiscountAmount > gross) throw new ArgumentOutOfRangeException(nameof(discount), "Item discount cannot exceed its gross amount.");
        Total = gross - DiscountAmount; Notes = TreatmentRules.Optional(notes, nameof(notes), 2000); UpdatedAt = now;
    }
}
