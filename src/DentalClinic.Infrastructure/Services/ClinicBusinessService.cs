using System.Data;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.ClinicBusiness;
using DentalClinic.Domain.Finance;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed record LabCaseInput(Guid VendorId, Guid PatientId, Guid? TreatmentId, string WorkType,
    string? Teeth, string? Material, string? Shade, string? Instructions, DateTimeOffset DueAt, decimal Cost);
public sealed record LabCaseUpdate(LabCaseStatus Status, string? Note);
public sealed record AllocationInput(Guid ItemId, decimal Amount);
public sealed record StatementInput(Guid VendorId, string? Reference, Guid[] CaseIds);
public sealed record SettlementInput(Guid? BatchId, string? Reference, AllocationInput[] Allocations);
public sealed record PolicyInput(Guid PatientId, Guid PayerId, string MemberNumber, DateTimeOffset? ExpiresAt, string? ReferralNumber);
public sealed record ClaimInput(Guid PatientInsuranceId, Guid TreatmentId, decimal RequestedAmount, decimal PatientShare, string? Notes);
public sealed record ClaimUpdate(InsuranceClaimStatus Status, decimal? ApprovedAmount, string? ApprovalNumber, string? ExternalClaimNumber, string? Notes);
public sealed record BatchInput(Guid PayerId, string? Reference, Guid[] ClaimIds);
public sealed record ClinicDocumentItem(Guid Id, string FileName, string ContentType, DateTimeOffset UploadedAt);
public sealed record ClinicActivityItem(Guid Id, string Action, string? ActorName, string? Details, DateTimeOffset OccurredAt);

public sealed class ClinicBusinessService(ApplicationDbContext db, ICurrentTenant tenant, ICurrentUser user)
{
    private Guid TenantId => tenant.RequireTenantId();
    private Guid ActorId => user.UserId ?? throw new InvalidOperationException("Authenticated user required.");
    private static string Reference(string prefix, string? requested) => !string.IsNullOrWhiteSpace(requested)
        ? LabVendor.Required(requested, 100)
        : $"{prefix}-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8]}";
    private void Log(string type, Guid id, string action, string? details = null) =>
        db.ClinicBusinessEvents.Add(new(TenantId, type, id, action, ActorId, details, DateTimeOffset.UtcNow));

    public Task<List<LabVendor>> VendorsAsync(CancellationToken token) => db.LabVendors.AsNoTracking().OrderBy(x => x.Name).ToListAsync(token);
    public async Task<Guid> AddVendorAsync(string name, string? phone, string? notes, CancellationToken token)
    { var item = new LabVendor(TenantId, name, phone, notes, DateTimeOffset.UtcNow); db.LabVendors.Add(item); Log("LabVendor", item.Id, "Created"); await db.SaveChangesAsync(token); return item.Id; }
    public Task<List<LabCase>> CasesAsync(Guid? patientId, CancellationToken token) => db.LabCases.AsNoTracking()
        .Where(x => !patientId.HasValue || x.PatientId == patientId).OrderByDescending(x => x.CreatedAt).Take(300).ToListAsync(token);
    public async Task<Guid> AddCaseAsync(LabCaseInput input, CancellationToken token)
    {
        if (!await db.LabVendors.AnyAsync(x => x.Id == input.VendorId, token) || !await db.Patients.AnyAsync(x => x.Id == input.PatientId, token)) throw new KeyNotFoundException("Vendor or patient not found.");
        if (input.TreatmentId.HasValue && !await db.Treatments.AnyAsync(x => x.Id == input.TreatmentId && x.PatientId == input.PatientId, token)) throw new ArgumentException("Treatment must belong to the selected patient.");
        var item = new LabCase(TenantId, input.VendorId, input.PatientId, input.TreatmentId, input.WorkType, input.Teeth,
            input.Material, input.Shade, input.Instructions, input.DueAt, input.Cost, DateTimeOffset.UtcNow);
        db.LabCases.Add(item); Log("LabCase", item.Id, "Created"); await db.SaveChangesAsync(token); return item.Id;
    }
    public async Task ChangeCaseAsync(Guid id, LabCaseUpdate input, CancellationToken token)
    { var item = await db.LabCases.SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Lab case not found."); item.SetStatus(input.Status, input.Note, DateTimeOffset.UtcNow); Log("LabCase", id, input.Status.ToString(), input.Note); await db.SaveChangesAsync(token); }
    public Task<List<LabStatement>> StatementsAsync(CancellationToken token) => db.LabStatements.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(token);
    public async Task<Guid> AddStatementAsync(StatementInput input, CancellationToken token)
    {
        if (input.CaseIds is not { Length: > 0 } || input.CaseIds.Distinct().Count() != input.CaseIds.Length) throw new ArgumentException("Select unique lab cases.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        if (!await db.LabVendors.AnyAsync(x => x.Id == input.VendorId, token)) throw new KeyNotFoundException("Vendor not found.");
        var cases = await db.LabCases.Where(x => input.CaseIds.Contains(x.Id)).ToListAsync(token);
        if (cases.Count != input.CaseIds.Length || cases.Any(x => x.VendorId != input.VendorId || x.StatementId.HasValue || x.Status is not (LabCaseStatus.Ready or LabCaseStatus.Delivered or LabCaseStatus.Fitted or LabCaseStatus.Remake))) throw new ArgumentException("Cases must be ready or delivered, unbilled and from one vendor.");
        var statement = new LabStatement(TenantId, input.VendorId, Reference("LAB", input.Reference), DateTimeOffset.UtcNow);
        db.LabStatements.Add(statement);
        foreach (var item in cases) item.AddToStatement(statement.Id);
        Log("LabStatement", statement.Id, "Created", $"{cases.Count} case(s)"); await db.SaveChangesAsync(token); await tx.CommitAsync(token); return statement.Id;
    }
    public async Task<object> StatementAsync(Guid id, CancellationToken token)
    {
        var statement = await db.LabStatements.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Statement not found.");
        var cases = await db.LabCases.AsNoTracking().Where(x => x.StatementId == id).ToListAsync(token);
        var payments = await db.LabSettlements.AsNoTracking().Where(x => x.StatementId == id).ToListAsync(token);
        return new { statement, cases = cases.Select(x => new { labCase = x, paid = payments.Where(p => p.CaseId == x.Id).Sum(p => p.Amount), outstanding = x.Cost - payments.Where(p => p.CaseId == x.Id).Sum(p => p.Amount) }), payments, total = cases.Sum(x => x.Cost), paid = payments.Sum(x => x.Amount) };
    }
    public async Task SettleStatementAsync(Guid id, SettlementInput input, CancellationToken token)
    {
        if (input.Allocations is not { Length: > 0 } || input.Allocations.GroupBy(x => x.ItemId).Any(x => x.Count() > 1)) throw new ArgumentException("Select unique cases to pay.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var statement = await db.LabStatements.SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Statement not found.");
        var ids = input.Allocations.Select(x => x.ItemId).ToArray();
        var cases = await db.LabCases.Where(x => ids.Contains(x.Id) && x.StatementId == id).ToDictionaryAsync(x => x.Id, token);
        if (cases.Count != ids.Length) throw new ArgumentException("Cases must belong to this statement.");
        var paid = await db.LabSettlements.Where(x => ids.Contains(x.CaseId)).GroupBy(x => x.CaseId).Select(x => new { x.Key, Amount = x.Sum(p => p.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Amount, token);
        var category = await db.FinancialCategories.SingleOrDefaultAsync(x => x.Code == "LAB_COST" && x.Type == FinancialCategoryType.Expense, token);
        if (category is null) { category = new FinancialCategory(TenantId, "Dental laboratory", "LAB_COST", FinancialCategoryType.Expense, null, DateTimeOffset.UtcNow); db.FinancialCategories.Add(category); }
        var currency = await db.TenantConfigurations.Select(x => x.Currency).SingleAsync(token);
        var vendor = await db.LabVendors.SingleAsync(x => x.Id == statement.VendorId, token);
        foreach (var allocation in input.Allocations)
        {
            var item = cases[allocation.ItemId];
            if (allocation.Amount <= 0 || allocation.Amount != decimal.Round(allocation.Amount, 2) || allocation.Amount > item.Cost - paid.GetValueOrDefault(item.Id)) throw new ArgumentException("Payment must use two decimals and cannot exceed an order's outstanding cost.");
            var now = DateTimeOffset.UtcNow;
            var expense = new Expense(TenantId, category.Id, allocation.Amount, currency, $"Lab case {item.WorkType}", vendor.Name, input.Reference, now, ActorId, null, now);
            db.Expenses.Add(expense);
            db.LabSettlements.Add(new(TenantId, id, item.Id, expense.Id, allocation.Amount, input.Reference, now));
            db.FinancialTransactions.Add(new(TenantId, FinancialTransactionType.Expense, expense.Amount, currency, now, FinancialSourceType.Expense, expense.Id, expense.Description, now));
            Log("LabCase", item.Id, "Payment", $"{allocation.Amount} {currency}");
        }
        await db.SaveChangesAsync(token); await tx.CommitAsync(token);
    }

    public Task<List<InsurancePayer>> PayersAsync(CancellationToken token) => db.InsurancePayers.AsNoTracking().OrderBy(x => x.Name).ToListAsync(token);
    public async Task<Guid> AddPayerAsync(string name, InsurancePayerKind kind, string? contractNumber, CancellationToken token)
    { var item = new InsurancePayer(TenantId, name, kind, contractNumber, DateTimeOffset.UtcNow); db.InsurancePayers.Add(item); Log("InsurancePayer", item.Id, "Created"); await db.SaveChangesAsync(token); return item.Id; }
    public Task<List<PatientInsurance>> PoliciesAsync(Guid? patientId, CancellationToken token) => db.PatientInsurances.AsNoTracking().Where(x => !patientId.HasValue || x.PatientId == patientId).OrderByDescending(x => x.CreatedAt).Take(300).ToListAsync(token);
    public async Task<Guid> AddPolicyAsync(PolicyInput input, CancellationToken token)
    {
        if (!await db.Patients.AnyAsync(x => x.Id == input.PatientId, token) || !await db.InsurancePayers.AnyAsync(x => x.Id == input.PayerId, token)) throw new KeyNotFoundException("Patient or payer not found.");
        var item = new PatientInsurance(TenantId, input.PatientId, input.PayerId, input.MemberNumber, input.ExpiresAt, input.ReferralNumber, DateTimeOffset.UtcNow);
        db.PatientInsurances.Add(item); Log("PatientInsurance", item.Id, "Created"); await db.SaveChangesAsync(token); return item.Id;
    }
    public Task<List<InsuranceClaim>> ClaimsAsync(Guid? patientId, CancellationToken token) => db.InsuranceClaims.AsNoTracking().Where(x => !patientId.HasValue || x.PatientId == patientId).OrderByDescending(x => x.CreatedAt).Take(300).ToListAsync(token);
    public async Task<object> InsuranceSummaryAsync(CancellationToken token)
    {
        var approved = await db.InsuranceClaims.Where(x => x.Status != InsuranceClaimStatus.Rejected && x.Status != InsuranceClaimStatus.Cancelled)
            .SumAsync(x => (decimal?)x.ApprovedAmount, token) ?? 0;
        var paid = await db.InsuranceSettlements.SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var currency = await db.TenantConfigurations.Select(x => x.Currency).SingleAsync(token);
        return new { outstanding = Math.Max(0, approved - paid), currency };
    }
    public async Task<object> ClaimAsync(Guid id, CancellationToken token)
    {
        var claim = await db.InsuranceClaims.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Claim not found.");
        var settlements = await db.InsuranceSettlements.AsNoTracking().Where(x => x.ClaimId == id).OrderByDescending(x => x.PaidAt).ToListAsync(token);
        var paid = settlements.Sum(x => x.Amount);
        return new { claim, settlements, paid, outstanding = (claim.ApprovedAmount ?? claim.RequestedAmount) - paid };
    }
    public async Task<Guid> AddClaimAsync(ClaimInput input, CancellationToken token)
    {
        var policy = await db.PatientInsurances.SingleOrDefaultAsync(x => x.Id == input.PatientInsuranceId, token) ?? throw new KeyNotFoundException("Policy not found.");
        var treatment = await db.Treatments.SingleOrDefaultAsync(x => x.Id == input.TreatmentId && x.PatientId == policy.PatientId, token) ?? throw new ArgumentException("Treatment must belong to the insured patient.");
        if (policy.ExpiresAt <= DateTimeOffset.UtcNow) throw new ArgumentException("Policy has expired.");
        if (input.RequestedAmount + input.PatientShare > treatment.Price) throw new ArgumentException("Claim and patient share exceed treatment price.");
        if (await db.InsuranceClaims.AnyAsync(x => x.TreatmentId == input.TreatmentId && x.PatientInsuranceId == input.PatientInsuranceId, token)) throw new ArgumentException("A claim already exists for this treatment and policy.");
        var item = new InsuranceClaim(TenantId, policy.Id, policy.PatientId, input.TreatmentId, input.RequestedAmount, input.PatientShare, input.Notes, DateTimeOffset.UtcNow);
        db.InsuranceClaims.Add(item); Log("InsuranceClaim", item.Id, "Created"); await db.SaveChangesAsync(token); return item.Id;
    }
    public async Task ChangeClaimAsync(Guid id, ClaimUpdate input, CancellationToken token)
    {
        var item = await db.InsuranceClaims.SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Claim not found.");
        var paid = await db.InsuranceSettlements.Where(x => x.ClaimId == id).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        if (paid > 0 && (input.Status is InsuranceClaimStatus.Rejected or InsuranceClaimStatus.Cancelled || input.ApprovedAmount < paid)) throw new ClinicBusinessConflictException("A paid claim cannot be rejected or reduced below its settlements.");
        item.SetStatus(input.Status, input.ApprovedAmount, input.ApprovalNumber, input.ExternalClaimNumber, input.Notes, DateTimeOffset.UtcNow);
        Log("InsuranceClaim", id, input.Status.ToString(), input.Notes); await db.SaveChangesAsync(token);
    }
    public Task<List<InsuranceBatch>> BatchesAsync(CancellationToken token) => db.InsuranceBatches.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(token);
    public async Task<Guid> AddBatchAsync(BatchInput input, CancellationToken token)
    {
        if (input.ClaimIds is not { Length: > 0 } || input.ClaimIds.Distinct().Count() != input.ClaimIds.Length) throw new ArgumentException("Select unique claims.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        if (!await db.InsurancePayers.AnyAsync(x => x.Id == input.PayerId, token)) throw new KeyNotFoundException("Payer not found.");
        var claims = await db.InsuranceClaims.Where(x => input.ClaimIds.Contains(x.Id)).ToListAsync(token);
        var policyIds = claims.Select(x => x.PatientInsuranceId).Distinct().ToArray();
        var policies = await db.PatientInsurances.Where(x => policyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, token);
        if (claims.Count != input.ClaimIds.Length || claims.Any(x => x.BatchId.HasValue || x.Status is not (InsuranceClaimStatus.Submitted or InsuranceClaimStatus.Approved or InsuranceClaimStatus.PartiallyApproved) || policies[x.PatientInsuranceId].PayerId != input.PayerId)) throw new ArgumentException("Claims must be submitted or approved, unbatched and from the same payer.");
        var batch = new InsuranceBatch(TenantId, input.PayerId, Reference("INS", input.Reference), DateTimeOffset.UtcNow);
        db.InsuranceBatches.Add(batch); foreach (var claim in claims) claim.AddToBatch(batch.Id);
        Log("InsuranceBatch", batch.Id, "Created", $"{claims.Count} claim(s)"); await db.SaveChangesAsync(token); await tx.CommitAsync(token); return batch.Id;
    }
    public async Task<object> BatchAsync(Guid id, CancellationToken token)
    {
        var batch = await db.InsuranceBatches.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Batch not found.");
        var claims = await db.InsuranceClaims.AsNoTracking().Where(x => x.BatchId == id).ToListAsync(token);
        var payments = await db.InsuranceSettlements.AsNoTracking().Where(x => x.BatchId == id).ToListAsync(token);
        return new { batch, claims = claims.Select(x => new { claim = x, paid = payments.Where(p => p.ClaimId == x.Id).Sum(p => p.Amount), outstanding = (x.ApprovedAmount ?? x.RequestedAmount) - payments.Where(p => p.ClaimId == x.Id).Sum(p => p.Amount) }), payments, requested = claims.Sum(x => x.RequestedAmount), paid = payments.Sum(x => x.Amount) };
    }
    public async Task SettleClaimsAsync(SettlementInput input, CancellationToken token)
    {
        if (input.Allocations is not { Length: > 0 } || input.Allocations.GroupBy(x => x.ItemId).Any(x => x.Count() > 1) || input.BatchId is null && input.Allocations.Length != 1) throw new ArgumentException("An individual settlement must contain one claim; grouped settlements need a batch.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
        var ids = input.Allocations.Select(x => x.ItemId).ToArray();
        var claims = await db.InsuranceClaims.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, token);
        if (claims.Count != ids.Length || claims.Values.Any(x => x.BatchId != input.BatchId || x.Status is not (InsuranceClaimStatus.Submitted or InsuranceClaimStatus.Approved or InsuranceClaimStatus.PartiallyApproved) || x.ApprovedAmount is null)) throw new ArgumentException("Claims need an approved amount and must belong to the selected batch.");
        if (input.BatchId.HasValue && !await db.InsuranceBatches.AnyAsync(x => x.Id == input.BatchId, token)) throw new KeyNotFoundException("Batch not found.");
        var paid = await db.InsuranceSettlements.Where(x => ids.Contains(x.ClaimId)).GroupBy(x => x.ClaimId).Select(x => new { x.Key, Amount = x.Sum(p => p.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Amount, token);
        var treatmentIds = claims.Values.Select(x => x.TreatmentId).ToArray();
        var revenues = await db.Revenues.Where(x => x.TreatmentId != null && treatmentIds.Contains(x.TreatmentId.Value)).ToListAsync(token);
        var revenueIds = revenues.Select(x => x.Id).ToArray();
        var revenuePaid = await db.Payments.Where(x => revenueIds.Contains(x.RevenueId)).GroupBy(x => x.RevenueId).Select(x => new { x.Key, Amount = x.Sum(p => p.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Amount, token);
        foreach (var allocation in input.Allocations)
        {
            var claim = claims[allocation.ItemId]; var cap = claim.ApprovedAmount ?? claim.RequestedAmount;
            if (allocation.Amount <= 0 || allocation.Amount != decimal.Round(allocation.Amount, 2) || allocation.Amount > cap - paid.GetValueOrDefault(claim.Id)) throw new ArgumentException("Settlement must use two decimals and cannot exceed the claim balance.");
            var revenue = revenues.SingleOrDefault(x => x.TreatmentId == claim.TreatmentId) ?? throw new ClinicBusinessConflictException("Complete treatment to create revenue before recording an insurer payment.");
            if (allocation.Amount > revenue.Amount - revenuePaid.GetValueOrDefault(revenue.Id)) throw new ArgumentException("Settlement exceeds outstanding treatment revenue.");
            revenuePaid[revenue.Id] = revenuePaid.GetValueOrDefault(revenue.Id) + allocation.Amount;
            var now = DateTimeOffset.UtcNow;
            var payment = new Payment(TenantId, claim.PatientId, revenue.Id, claim.TreatmentId, allocation.Amount, revenue.Currency, PaymentMethod.BankTransfer, input.Reference, "Insurance settlement", now, ActorId, now);
            db.Payments.Add(payment);
            db.InsuranceSettlements.Add(new(TenantId, claim.Id, input.BatchId, payment.Id, allocation.Amount, input.Reference, now));
            db.FinancialTransactions.Add(new(TenantId, FinancialTransactionType.Payment, payment.Amount, payment.Currency, now, FinancialSourceType.Payment, payment.Id, "Insurance settlement", now));
            if (paid.GetValueOrDefault(claim.Id) + allocation.Amount == cap) claim.MarkSettled(now);
            Log("InsuranceClaim", claim.Id, "Settlement", $"{allocation.Amount} {revenue.Currency}");
        }
        await db.SaveChangesAsync(token); await tx.CommitAsync(token);
    }
    public Task<List<ClinicActivityItem>> HistoryAsync(string type, Guid id, CancellationToken token) => db.ClinicBusinessEvents.AsNoTracking()
        .Where(x => x.EntityType == type && x.EntityId == id).OrderByDescending(x => x.OccurredAt).Take(100)
        .Select(x => new ClinicActivityItem(x.Id, x.Action,
            db.ClinicUsers.Where(u => u.Id == x.ActorId).Select(u => u.DisplayName).FirstOrDefault(), x.Details, x.OccurredAt)).ToListAsync(token);
    public Task<List<ClinicDocumentItem>> DocumentsAsync(string type, Guid id, CancellationToken token) => db.ClinicBusinessDocuments.AsNoTracking()
        .Where(x => x.EntityType == type && x.EntityId == id).OrderByDescending(x => x.UploadedAt)
        .Select(x => new ClinicDocumentItem(x.Id, x.FileName, x.ContentType, x.UploadedAt)).ToListAsync(token);
    public Task<ClinicBusinessDocument?> DocumentAsync(string type, Guid id, CancellationToken token) => db.ClinicBusinessDocuments.AsNoTracking()
        .SingleOrDefaultAsync(x => x.Id == id && x.EntityType == type, token);
    public async Task<Guid> AddDocumentAsync(string type, Guid id, string fileName, string contentType, Stream data, CancellationToken token)
    {
        if (type == "LabCase" && !await db.LabCases.AnyAsync(x => x.Id == id, token) ||
            type == "InsuranceClaim" && !await db.InsuranceClaims.AnyAsync(x => x.Id == id, token)) throw new KeyNotFoundException("Case or claim not found.");
        if (type is not ("LabCase" or "InsuranceClaim")) throw new ArgumentException("Invalid document type.");
        await using var memory = new MemoryStream();
        var buffer = new byte[81920]; int read;
        while ((read = await data.ReadAsync(buffer, token)) > 0)
        { if (memory.Length + read > 5_242_880) throw new ArgumentException("File must be 5 MB or smaller."); await memory.WriteAsync(buffer.AsMemory(0, read), token); }
        var bytes = memory.ToArray();
        var valid = contentType switch
        {
            "application/pdf" => bytes.Length >= 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F',
            "image/jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
            "image/png" => bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            _ => false
        };
        if (!valid) throw new ArgumentException("The file contents do not match PDF, JPEG or PNG.");
        var item = new ClinicBusinessDocument(TenantId, type, id, fileName, contentType, bytes, ActorId, DateTimeOffset.UtcNow);
        db.ClinicBusinessDocuments.Add(item); Log(type, id, "DocumentAdded", item.FileName); await db.SaveChangesAsync(token); return item.Id;
    }
}
