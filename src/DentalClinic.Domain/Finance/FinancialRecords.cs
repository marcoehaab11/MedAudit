using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Finance;

public sealed class Revenue : TenantOwnedEntity
{
    private Revenue() { }
    public Revenue(Guid tenantId, Guid categoryId, Guid? patientId, Guid? treatmentId, Guid? treatmentPlanId,
        Guid? doctorProfileId, decimal amount, string currency, string description, DateTimeOffset occurredAt, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || categoryId == Guid.Empty) throw new ArgumentException("Tenant and category are required.");
        TenantId = tenantId; CategoryId = categoryId; PatientId = patientId; TreatmentId = treatmentId;
        TreatmentPlanId = treatmentPlanId; DoctorProfileId = doctorProfileId; Amount = FinanceRules.NonNegative(amount, nameof(amount));
        Currency = FinanceRules.Currency(currency); Description = FinanceRules.Required(description, nameof(description), 500);
        OccurredAt = occurredAt; CreatedAt = createdAt;
    }
    public Guid CategoryId { get; private set; }
    public Guid? PatientId { get; private set; }
    public Guid? TreatmentId { get; private set; }
    public Guid? TreatmentPlanId { get; private set; }
    public Guid? DoctorProfileId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty; public string Description { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class Payment : TenantOwnedEntity
{
    private Payment() { }
    public Payment(Guid tenantId, Guid? patientId, Guid revenueId, Guid? treatmentId, decimal amount, string currency,
        PaymentMethod method, string? reference, string? notes, DateTimeOffset paidAt, Guid createdBy, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || revenueId == Guid.Empty || createdBy == Guid.Empty || !Enum.IsDefined(method)) throw new ArgumentException("Tenant, revenue, creator and method are required.");
        TenantId = tenantId; PatientId = patientId; RevenueId = revenueId; TreatmentId = treatmentId;
        Amount = FinanceRules.Positive(amount, nameof(amount)); Currency = FinanceRules.Currency(currency); PaymentMethod = method;
        Reference = FinanceRules.Optional(reference, nameof(reference), 150); Notes = FinanceRules.Optional(notes, nameof(notes), 1000);
        PaidAt = paidAt; CreatedBy = createdBy; CreatedAt = createdAt;
    }
    public Guid? PatientId { get; private set; }
    public Guid RevenueId { get; private set; }
    public Guid? TreatmentId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public PaymentMethod PaymentMethod { get; private set; }
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset PaidAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
}

public sealed class Expense : TenantOwnedEntity
{
    private Expense() { }
    public Expense(Guid tenantId, Guid categoryId, decimal amount, string currency, string description, string? vendorName,
        string? reference, DateTimeOffset expenseDate, Guid createdBy, string? notes, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || categoryId == Guid.Empty || createdBy == Guid.Empty) throw new ArgumentException("Tenant, category and creator are required.");
        TenantId = tenantId; CategoryId = categoryId; Amount = FinanceRules.Positive(amount, nameof(amount)); Currency = FinanceRules.Currency(currency);
        Description = FinanceRules.Required(description, nameof(description), 500); VendorName = FinanceRules.Optional(vendorName, nameof(vendorName), 200);
        Reference = FinanceRules.Optional(reference, nameof(reference), 150); ExpenseDate = expenseDate; CreatedBy = createdBy;
        Notes = FinanceRules.Optional(notes, nameof(notes), 1000); CreatedAt = createdAt;
    }
    public Guid CategoryId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty; public string Description { get; private set; } = string.Empty;
    public string? VendorName { get; private set; }
    public string? Reference { get; private set; }
    public DateTimeOffset ExpenseDate { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public string? Notes { get; private set; }
}

public sealed class DoctorCompensationCost : TenantOwnedEntity
{
    private DoctorCompensationCost() { }
    public DoctorCompensationCost(Guid tenantId, Guid treatmentId, Guid doctorProfileId, decimal amount, string currency,
        string ruleSnapshot, DateTimeOffset occurredAt, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || treatmentId == Guid.Empty || doctorProfileId == Guid.Empty) throw new ArgumentException("Tenant, treatment and doctor are required.");
        TenantId = tenantId; TreatmentId = treatmentId; DoctorProfileId = doctorProfileId; Amount = FinanceRules.Positive(amount, nameof(amount));
        Currency = FinanceRules.Currency(currency); CompensationRuleSnapshot = FinanceRules.Required(ruleSnapshot, nameof(ruleSnapshot), 500);
        OccurredAt = occurredAt; CreatedAt = createdAt;
    }
    public Guid TreatmentId { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public string CompensationRuleSnapshot { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class FinancialTransaction : TenantOwnedEntity
{
    private FinancialTransaction() { }
    public FinancialTransaction(Guid tenantId, FinancialTransactionType type, decimal amount, string currency,
        DateTimeOffset occurredAt, FinancialSourceType sourceType, Guid sourceId, string description, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || sourceId == Guid.Empty || !Enum.IsDefined(type) || !Enum.IsDefined(sourceType)) throw new ArgumentException("Valid tenant, type and source are required.");
        TenantId = tenantId; Type = type; Amount = FinanceRules.NonNegative(amount, nameof(amount)); Currency = FinanceRules.Currency(currency);
        OccurredAt = occurredAt; SourceType = sourceType; SourceId = sourceId;
        Description = FinanceRules.Required(description, nameof(description), 500); CreatedAt = createdAt;
    }
    public FinancialTransactionType Type { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty; public DateTimeOffset OccurredAt { get; private set; }
    public FinancialSourceType SourceType { get; private set; }
    public Guid SourceId { get; private set; }
    public string Description { get; private set; } = string.Empty; public DateTimeOffset CreatedAt { get; private set; }
}
