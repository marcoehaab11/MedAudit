using System.Globalization;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Finance;

public sealed class DoctorCompensationCalculator : IDoctorCompensationCalculator
{
    public CompensationResult Calculate(FinanceDoctorRule? rule, decimal treatmentAmount)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(treatmentAmount);
        if (rule?.Type is not (CompensationType.Percentage or CompensationType.FixedSalaryAndPercentage) || rule.Percentage is null)
            return new(0, null, rule is null ? "No effective compensation rule" : $"{rule.Type}; fixed salary excluded from treatment cost");
        var amount = decimal.Round(treatmentAmount * rule.Percentage.Value / 100m, 2, MidpointRounding.AwayFromZero);
        return new(amount, rule.Percentage, $"Rule={rule.Id:D};Type={rule.Type};Percentage={rule.Percentage.Value.ToString(CultureInfo.InvariantCulture)};EffectiveFrom={rule.EffectiveFrom:yyyy-MM-dd};EffectiveTo={rule.EffectiveTo:yyyy-MM-dd}");
    }
}

internal sealed class FinanceQueries(IFinanceStore store, IPermissionService permissions) : IFinanceQueries
{
    public async Task<FinanceSummary> DashboardAsync(FinanceDateFilter filter, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceDashboard, token); return await store.DashboardAsync(await store.ResolveRangeAsync(filter, token), token); }
    public async Task<PagedResult<RevenueItem>> RevenuesAsync(RevenueSearch x, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceRevenueView, token); Validate(x.Page, x.PageSize, x.From, x.To); return await store.RevenuesAsync(x, await store.ResolveRangeAsync(new(FinancePeriod.Custom, x.From, x.To), token), token); }
    public async Task<PagedResult<PaymentItem>> PaymentsAsync(PaymentSearch x, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinancePaymentsView, token); Validate(x.Page, x.PageSize, x.From, x.To); return await store.PaymentsAsync(x, await store.ResolveRangeAsync(new(FinancePeriod.Custom, x.From, x.To), token), token); }
    public async Task<PagedResult<ExpenseItem>> ExpensesAsync(ExpenseSearch x, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceExpensesView, token); Validate(x.Page, x.PageSize, x.From, x.To); return await store.ExpensesAsync(x, await store.ResolveRangeAsync(new(FinancePeriod.Custom, x.From, x.To), token), token); }
    public async Task<PatientBalance?> PatientBalanceAsync(Guid id, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceView, token); return await store.FindPatientAsync(id, token) is null ? null : await store.PatientBalanceAsync(id, token); }
    public async Task<RevenueItem?> RevenueAsync(Guid id, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceRevenueView, token); return await store.RevenueAsync(id, token); }
    private static void Validate(int page, int size, DateOnly? from, DateOnly? to) { if (page < 1 || size is < 1 or > 100 || from > to) throw new ArgumentException("Invalid finance search."); }
}

internal sealed class FinancialCategoryService(IFinanceStore store, IPermissionService permissions, ICurrentTenant tenant,
    ICurrentUser user, ISystemClock clock) : IFinancialCategoryService
{
    public async Task<IReadOnlyCollection<FinancialCategoryItem>> ListAsync(bool inactive, FinancialCategoryType? type, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceCategoriesView, token); return await store.CategoriesAsync(inactive, type, token); }
    public async Task<Guid> CreateAsync(FinancialCategoryInput x, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceCategoriesManage, token); await ValidateAsync(Guid.Empty, x, token); var item = new FinancialCategory(tenant.RequireTenantId(), x.Name, x.Code, x.Type, x.ParentId, clock.UtcNow); store.AddCategory(item); Audit(PlatformAuditAction.FinancialCategoryCreated, item.Id); await store.SaveChangesAsync(token); return item.Id; }
    public async Task<bool> UpdateAsync(Guid id, FinancialCategoryInput x, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceCategoriesManage, token); var item = await store.FindCategoryAsync(id, true, token); if (item is null) return false; await ValidateAsync(id, x, token); item.Update(x.Name, x.Code, x.Type, x.ParentId, version, clock.UtcNow); Audit(PlatformAuditAction.FinancialCategoryUpdated, id); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> SetActiveAsync(Guid id, bool active, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceCategoriesManage, token); var item = await store.FindCategoryAsync(id, true, token); if (item is null) return false; item.SetActive(active, version, clock.UtcNow); Audit(PlatformAuditAction.FinancialCategoryUpdated, id); await store.SaveChangesAsync(token); return true; }
    private async Task ValidateAsync(Guid id, FinancialCategoryInput x, CancellationToken token)
    { if (!Enum.IsDefined(x.Type)) throw new ArgumentException("Invalid category type."); if (await store.CategoryCodeExistsAsync(x.Code.Trim().ToUpperInvariant(), id == Guid.Empty ? null : id, token)) throw new FinanceConflictException("Category code is already in use."); if (x.ParentId.HasValue) { var p = await store.FindCategoryAsync(x.ParentId.Value, false, token); if (p is null || p.Type != x.Type || await store.CategoryCreatesCycleAsync(id, x.ParentId, token)) throw new ArgumentException("Invalid category parent."); } }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, nameof(FinancialCategory), id, clock.UtcNow, null));
}

internal sealed class PaymentService(IFinanceStore store, IPermissionService permissions, ICurrentTenant tenant,
    ICurrentUser user, ISystemClock clock) : IPaymentService
{
    public async Task<Guid> CreateAsync(PaymentInput x, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.FinancePaymentsCreate, token);
        var revenue = x.RevenueId.HasValue ? await store.FindRevenueAsync(x.RevenueId.Value, token) : x.TreatmentId.HasValue ? await store.FindRevenueByTreatmentAsync(x.TreatmentId.Value, token) : null;
        if (revenue is null) throw new FinanceNotFoundException("A posted revenue or completed treatment revenue is required.");
        if (x.PatientId.HasValue && revenue.PatientId != x.PatientId || x.TreatmentId.HasValue && revenue.TreatmentId != x.TreatmentId) throw new ArgumentException("Payment references do not match the revenue.");
        var range = await store.ResolveRangeAsync(new(FinancePeriod.Custom, x.PaidDate, x.PaidDate), token);
        var paidAt = ToUtc(x.PaidDate, x.PaidTime, range.TimeZone);
        await using var transaction = await store.BeginTransactionAsync(token); await store.LockRevenueAsync(revenue.Id, token);
        var paid = await store.PaidForRevenueAsync(revenue.Id, token); var amount = x.Amount;
        if (amount <= 0 || amount > revenue.Amount - paid) throw new FinanceConflictException("Payment exceeds the outstanding revenue amount.");
        var item = new Payment(tenant.RequireTenantId(), revenue.PatientId, revenue.Id, revenue.TreatmentId, amount, revenue.Currency, x.PaymentMethod, x.Reference, x.Notes, paidAt, user.UserId ?? throw new InvalidOperationException("Authenticated user is required."), clock.UtcNow);
        store.AddPayment(item); store.AddTransaction(new(item.TenantId, FinancialTransactionType.Payment, item.Amount, item.Currency, item.PaidAt, FinancialSourceType.Payment, item.Id, "Payment received", item.CreatedAt));
        store.AddAudit(new(item.TenantId, user.UserId, PlatformAuditAction.PaymentCreated, nameof(Payment), item.Id, clock.UtcNow, null)); await store.SaveChangesAsync(token); await transaction.CommitAsync(token); return item.Id;
    }
    internal static DateTimeOffset ToUtc(DateOnly date, TimeOnly time, string zoneId)
    { var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId); var local = date.ToDateTime(time, DateTimeKind.Unspecified); if (zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local)) throw new ArgumentException("The selected local time is invalid or ambiguous in the clinic timezone."); return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone), TimeSpan.Zero); }
}

internal sealed class ExpenseService(IFinanceStore store, IPermissionService permissions, ICurrentTenant tenant,
    ICurrentUser user, ISystemClock clock) : IExpenseService
{
    public async Task<Guid> CreateAsync(ExpenseInput x, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.FinanceExpensesCreate, token); var category = await store.FindCategoryAsync(x.CategoryId, false, token); if (category is null || !category.IsActive || category.Type != FinancialCategoryType.Expense) throw new ArgumentException("An active expense category is required."); var range = await store.ResolveRangeAsync(new(FinancePeriod.Custom, x.ExpenseDate, x.ExpenseDate), token); var currency = string.IsNullOrWhiteSpace(x.Currency) ? range.Currency : x.Currency; if (!string.Equals(currency, range.Currency, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Expense currency must match the clinic currency."); var occurred = PaymentService.ToUtc(x.ExpenseDate, x.ExpenseTime, range.TimeZone); var item = new Expense(tenant.RequireTenantId(), category.Id, x.Amount, currency!, x.Description, x.VendorName, x.Reference, occurred, user.UserId ?? throw new InvalidOperationException("Authenticated user is required."), x.Notes, clock.UtcNow); store.AddExpense(item); store.AddTransaction(new(item.TenantId, FinancialTransactionType.Expense, item.Amount, item.Currency, item.ExpenseDate, FinancialSourceType.Expense, item.Id, item.Description, item.CreatedAt)); store.AddAudit(new(item.TenantId, user.UserId, PlatformAuditAction.ExpenseCreated, nameof(Expense), item.Id, clock.UtcNow, null)); await store.SaveChangesAsync(token); return item.Id; }
}

internal sealed class TreatmentRevenueCreator(IFinanceStore store, IDoctorCompensationCalculator calculator,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : ITreatmentRevenueCreator
{
    public async Task EnsureForCompletedTreatmentAsync(Guid treatmentId, CancellationToken token)
    {
        if (await store.FindRevenueByTreatmentAsync(treatmentId, token) is not null) return;
        var treatment = await store.FindTreatmentAsync(treatmentId, token) ?? throw new FinanceNotFoundException("Treatment was not found.");
        if (treatment.Status != TreatmentStatus.Completed || treatment.CompletedAt is null) throw new FinanceConflictException("Only completed treatments create revenue.");
        var category = await store.FindCategoryByCodeAsync("TREATMENT_REVENUE", FinancialCategoryType.Revenue, token) ?? throw new FinanceConflictException("Treatment revenue category is not initialized.");
        var currency = await store.CurrencyAsync(token); var now = clock.UtcNow;
        var revenue = new Revenue(tenant.RequireTenantId(), category.Id, treatment.PatientId, treatment.Id, treatment.TreatmentPlanId, treatment.DoctorProfileId, treatment.Amount, currency, treatment.Name, treatment.CompletedAt.Value, now);
        store.AddRevenue(revenue); store.AddTransaction(new(revenue.TenantId, FinancialTransactionType.Revenue, revenue.Amount, revenue.Currency, revenue.OccurredAt, FinancialSourceType.Revenue, revenue.Id, revenue.Description, now));
        store.AddAudit(new(revenue.TenantId, user.UserId, PlatformAuditAction.RevenueCreated, nameof(Revenue), revenue.Id, now, null));
        var range = await store.ResolveRangeAsync(new(FinancePeriod.Custom, DateOnly.FromDateTime(treatment.CompletedAt.Value.UtcDateTime), DateOnly.FromDateTime(treatment.CompletedAt.Value.UtcDateTime)), token);
        var date = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(treatment.CompletedAt.Value, TimeZoneInfo.FindSystemTimeZoneById(range.TimeZone)).DateTime);
        var result = calculator.Calculate(await store.FindCompensationRuleAsync(treatment.DoctorProfileId, date, token), treatment.Amount);
        store.AddAudit(new(revenue.TenantId, user.UserId, PlatformAuditAction.DoctorCompensationCalculated, nameof(DoctorCompensationCost), treatment.Id, now, null));
        if (result.Amount > 0) { var cost = new DoctorCompensationCost(revenue.TenantId, treatment.Id, treatment.DoctorProfileId, result.Amount, currency, result.Snapshot, treatment.CompletedAt.Value, now); store.AddDoctorCost(cost); store.AddTransaction(new(cost.TenantId, FinancialTransactionType.DoctorCompensation, cost.Amount, cost.Currency, cost.OccurredAt, FinancialSourceType.DoctorCompensation, cost.Id, "Treatment percentage compensation", now)); store.AddAudit(new(cost.TenantId, user.UserId, PlatformAuditAction.DoctorCompensationRecorded, nameof(DoctorCompensationCost), cost.Id, now, null)); }
    }
}
