using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.ClinicBusiness;

public enum LabCaseStatus { Draft = 1, Sent = 2, ReceivedByLab = 3, InProduction = 4, Ready = 5, Delivered = 6, Fitted = 7, Remake = 8, Cancelled = 9 }
public enum InsurancePayerKind { Private = 1, UniversalHealth = 2 }
public enum InsuranceClaimStatus { Draft = 1, EligibilityChecked = 2, ApprovalPending = 3, Approved = 4, Rejected = 5, Submitted = 6, PartiallyApproved = 7, Settled = 8, Cancelled = 9 }
public sealed class ClinicBusinessConflictException(string message) : Exception(message);

public sealed class LabVendor : TenantOwnedEntity
{
    private LabVendor() { }
    public LabVendor(Guid tenantId, string name, string? phone, string? notes, DateTimeOffset now)
    { TenantId = tenantId; Name = Required(name, 200); Phone = Optional(phone, 50); Notes = Optional(notes, 1000); CreatedAt = now; }
    public string Name { get; private set; } = "";
    public string? Phone { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public static string Required(string? value, int max) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= max ? value.Trim() : throw new ArgumentException("A valid value is required.");
    public static string? Optional(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : Required(value, max);
}

public sealed class LabCase : TenantOwnedEntity
{
    private LabCase() { }
    public LabCase(Guid tenantId, Guid vendorId, Guid patientId, Guid? treatmentId, string workType, string? teeth,
        string? material, string? shade, string? instructions, DateTimeOffset dueAt, decimal cost, DateTimeOffset now)
    {
        if (vendorId == Guid.Empty || patientId == Guid.Empty || cost < 0 || cost != decimal.Round(cost, 2) || dueAt <= now) throw new ArgumentException("Invalid lab case details.");
        TenantId = tenantId; VendorId = vendorId; PatientId = patientId; TreatmentId = treatmentId;
        WorkType = LabVendor.Required(workType, 150); Teeth = LabVendor.Optional(teeth, 100);
        Material = LabVendor.Optional(material, 100); Shade = LabVendor.Optional(shade, 50);
        Instructions = LabVendor.Optional(instructions, 3000); DueAt = dueAt; Cost = decimal.Round(cost, 2); CreatedAt = now;
        Status = LabCaseStatus.Draft;
    }
    public Guid VendorId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid? TreatmentId { get; private set; }
    public Guid? StatementId { get; private set; }
    public string WorkType { get; private set; } = "";
    public string? Teeth { get; private set; }
    public string? Material { get; private set; }
    public string? Shade { get; private set; }
    public string? Instructions { get; private set; }
    public DateTimeOffset DueAt { get; private set; }
    public decimal Cost { get; private set; }
    public LabCaseStatus Status { get; private set; }
    public int RemakeCount { get; private set; }
    public string? LastUpdateNote { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public void SetStatus(LabCaseStatus next, string? note, DateTimeOffset now)
    {
        if (!Enum.IsDefined(next) || next == Status || Status == LabCaseStatus.Cancelled ||
            (next == LabCaseStatus.Fitted && Status != LabCaseStatus.Delivered) ||
            (Status == LabCaseStatus.Fitted && next != LabCaseStatus.Remake) ||
            (next == LabCaseStatus.Remake && Status is not (LabCaseStatus.Delivered or LabCaseStatus.Fitted)) ||
            (next == LabCaseStatus.Cancelled && StatementId.HasValue)) throw new ClinicBusinessConflictException("Invalid lab case transition.");
        if (next == LabCaseStatus.Remake) RemakeCount++;
        Status = next; LastUpdateNote = LabVendor.Optional(note, 1000); UpdatedAt = now;
    }
    public void AddToStatement(Guid statementId)
    { if (StatementId.HasValue || Status is not (LabCaseStatus.Ready or LabCaseStatus.Delivered or LabCaseStatus.Fitted or LabCaseStatus.Remake)) throw new ClinicBusinessConflictException("Only ready or delivered cases can be included in a laboratory statement."); StatementId = statementId; }
}

public sealed class LabStatement : TenantOwnedEntity
{
    private LabStatement() { }
    public LabStatement(Guid tenantId, Guid vendorId, string reference, DateTimeOffset now)
    { TenantId = tenantId; VendorId = vendorId; Reference = LabVendor.Required(reference, 100); CreatedAt = now; }
    public Guid VendorId { get; private set; }
    public string Reference { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class LabSettlement : TenantOwnedEntity
{
    private LabSettlement() { }
    public LabSettlement(Guid tenantId, Guid statementId, Guid caseId, Guid expenseId, decimal amount, string? reference, DateTimeOffset now)
    { ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amount); if (expenseId == Guid.Empty) throw new ArgumentException("Expense is required."); TenantId = tenantId; StatementId = statementId; CaseId = caseId; ExpenseId = expenseId; Amount = decimal.Round(amount, 2); Reference = LabVendor.Optional(reference, 100); PaidAt = now; }
    public Guid StatementId { get; private set; }
    public Guid CaseId { get; private set; }
    public Guid ExpenseId { get; private set; }
    public decimal Amount { get; private set; }
    public string? Reference { get; private set; }
    public DateTimeOffset PaidAt { get; private set; }
}

public sealed class InsurancePayer : TenantOwnedEntity
{
    private InsurancePayer() { }
    public InsurancePayer(Guid tenantId, string name, InsurancePayerKind kind, string? contractNumber, DateTimeOffset now)
    { if (!Enum.IsDefined(kind)) throw new ArgumentException("Invalid payer type."); TenantId = tenantId; Name = LabVendor.Required(name, 200); Kind = kind; ContractNumber = LabVendor.Optional(contractNumber, 100); CreatedAt = now; }
    public string Name { get; private set; } = "";
    public InsurancePayerKind Kind { get; private set; }
    public string? ContractNumber { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class PatientInsurance : TenantOwnedEntity
{
    private PatientInsurance() { }
    public PatientInsurance(Guid tenantId, Guid patientId, Guid payerId, string memberNumber, DateTimeOffset? expiresAt, string? referralNumber, DateTimeOffset now)
    { TenantId = tenantId; PatientId = patientId; PayerId = payerId; MemberNumber = LabVendor.Required(memberNumber, 100); ExpiresAt = expiresAt; ReferralNumber = LabVendor.Optional(referralNumber, 100); CreatedAt = now; }
    public Guid PatientId { get; private set; }
    public Guid PayerId { get; private set; }
    public string MemberNumber { get; private set; } = "";
    public DateTimeOffset? ExpiresAt { get; private set; }
    public string? ReferralNumber { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class InsuranceClaim : TenantOwnedEntity
{
    private InsuranceClaim() { }
    public InsuranceClaim(Guid tenantId, Guid patientInsuranceId, Guid patientId, Guid treatmentId, decimal requested,
        decimal patientShare, string? notes, DateTimeOffset now)
    {
        if (requested <= 0 || patientShare < 0 || requested != decimal.Round(requested, 2) || patientShare != decimal.Round(patientShare, 2)) throw new ArgumentException("Invalid claim amounts.");
        TenantId = tenantId; PatientInsuranceId = patientInsuranceId; PatientId = patientId; TreatmentId = treatmentId;
        RequestedAmount = decimal.Round(requested, 2); PatientShare = decimal.Round(patientShare, 2);
        Notes = LabVendor.Optional(notes, 2000); Status = InsuranceClaimStatus.Draft; CreatedAt = now;
    }
    public Guid PatientInsuranceId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid TreatmentId { get; private set; }
    public Guid? BatchId { get; private set; }
    public decimal RequestedAmount { get; private set; }
    public decimal PatientShare { get; private set; }
    public decimal? ApprovedAmount { get; private set; }
    public InsuranceClaimStatus Status { get; private set; }
    public string? ApprovalNumber { get; private set; }
    public string? ExternalClaimNumber { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public void SetStatus(InsuranceClaimStatus next, decimal? approved, string? approvalNumber, string? externalClaimNumber, string? notes, DateTimeOffset now)
    {
        if (!Enum.IsDefined(next) || next == Status || next == InsuranceClaimStatus.Settled || Status is InsuranceClaimStatus.Settled or InsuranceClaimStatus.Cancelled ||
            (next == InsuranceClaimStatus.Cancelled && BatchId.HasValue) ||
            (next is InsuranceClaimStatus.Approved or InsuranceClaimStatus.PartiallyApproved && !approved.HasValue) ||
            (approved.HasValue && (approved < 0 || approved > RequestedAmount))) throw new ClinicBusinessConflictException("Invalid claim transition or amount.");
        Status = next; ApprovedAmount = approved ?? ApprovedAmount;
        ApprovalNumber = LabVendor.Optional(approvalNumber, 100) ?? ApprovalNumber;
        ExternalClaimNumber = LabVendor.Optional(externalClaimNumber, 100) ?? ExternalClaimNumber;
        Notes = LabVendor.Optional(notes, 2000) ?? Notes; UpdatedAt = now;
    }
    public void AddToBatch(Guid batchId)
    { if (BatchId.HasValue || Status is not (InsuranceClaimStatus.Submitted or InsuranceClaimStatus.Approved or InsuranceClaimStatus.PartiallyApproved)) throw new ClinicBusinessConflictException("Only submitted or approved claims can be batched."); BatchId = batchId; }
    public void MarkSettled(DateTimeOffset now) { Status = InsuranceClaimStatus.Settled; UpdatedAt = now; }
}

public sealed class InsuranceBatch : TenantOwnedEntity
{
    private InsuranceBatch() { }
    public InsuranceBatch(Guid tenantId, Guid payerId, string reference, DateTimeOffset now)
    { TenantId = tenantId; PayerId = payerId; Reference = LabVendor.Required(reference, 100); CreatedAt = now; }
    public Guid PayerId { get; private set; }
    public string Reference { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
}

public sealed class InsuranceSettlement : TenantOwnedEntity
{
    private InsuranceSettlement() { }
    public InsuranceSettlement(Guid tenantId, Guid claimId, Guid? batchId, Guid paymentId, decimal amount, string? reference, DateTimeOffset now)
    { ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amount); if (paymentId == Guid.Empty) throw new ArgumentException("Payment is required."); TenantId = tenantId; ClaimId = claimId; BatchId = batchId; PaymentId = paymentId; Amount = decimal.Round(amount, 2); Reference = LabVendor.Optional(reference, 100); PaidAt = now; }
    public Guid ClaimId { get; private set; }
    public Guid? BatchId { get; private set; }
    public Guid PaymentId { get; private set; }
    public decimal Amount { get; private set; }
    public string? Reference { get; private set; }
    public DateTimeOffset PaidAt { get; private set; }
}

public sealed class ClinicBusinessEvent : TenantOwnedEntity
{
    private ClinicBusinessEvent() { }
    public ClinicBusinessEvent(Guid tenantId, string entityType, Guid entityId, string action, Guid actorId, string? details, DateTimeOffset now)
    { TenantId = tenantId; EntityType = LabVendor.Required(entityType, 40); EntityId = entityId; Action = LabVendor.Required(action, 60); ActorId = actorId; Details = LabVendor.Optional(details, 1000); OccurredAt = now; }
    public string EntityType { get; private set; } = "";
    public Guid EntityId { get; private set; }
    public string Action { get; private set; } = "";
    public Guid ActorId { get; private set; }
    public string? Details { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
}

public sealed class ClinicBusinessDocument : TenantOwnedEntity
{
    private ClinicBusinessDocument() { }
    public ClinicBusinessDocument(Guid tenantId, string entityType, Guid entityId, string fileName, string contentType, byte[] content, Guid uploadedBy, DateTimeOffset now)
    {
        if (entityType is not ("LabCase" or "InsuranceClaim") || entityId == Guid.Empty || uploadedBy == Guid.Empty || content.Length is 0 or > 5_242_880)
            throw new ArgumentException("Invalid document.");
        TenantId = tenantId; EntityType = entityType; EntityId = entityId;
        FileName = LabVendor.Required(Path.GetFileName(fileName.Replace('\\', '/')), 200);
        ContentType = contentType is "application/pdf" or "image/jpeg" or "image/png" ? contentType : throw new ArgumentException("Only PDF, JPEG and PNG files are supported.");
        Content = content; UploadedBy = uploadedBy; UploadedAt = now;
    }
    public string EntityType { get; private set; } = "";
    public Guid EntityId { get; private set; }
    public string FileName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public byte[] Content { get; private set; } = [];
    public Guid UploadedBy { get; private set; }
    public DateTimeOffset UploadedAt { get; private set; }
}
