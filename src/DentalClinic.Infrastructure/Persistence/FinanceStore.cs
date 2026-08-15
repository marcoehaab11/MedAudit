using System.Data;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class FinanceStore(ApplicationDbContext context, ISystemClock clock, ICurrentTenant currentTenant) : IFinanceStore
{
    public async Task<FinanceRange> ResolveRangeAsync(FinanceDateFilter filter, CancellationToken token)
    {
        var config = await context.TenantConfigurations.AsNoTracking().Select(x => new { x.TimeZone, x.Currency }).SingleAsync(token);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(config.TimeZone); var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow, zone).DateTime);
        DateOnly from; DateOnly to;
        switch (filter.Period)
        {
            case FinancePeriod.Today: from = to = today; break;
            case FinancePeriod.ThisWeek: from = today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7)); to = today; break;
            case FinancePeriod.ThisMonth: from = new(today.Year, today.Month, 1); to = today; break;
            case FinancePeriod.ThisYear: from = new(today.Year, 1, 1); to = today; break;
            case FinancePeriod.Custom: from = filter.From ?? new DateOnly(1900, 1, 1); to = filter.To ?? new DateOnly(2200, 12, 31); break;
            default: throw new ArgumentException("Invalid finance period.");
        }
        if (from > to) throw new ArgumentException("From date cannot exceed to date.");
        return new(ToUtc(from, zone), ToUtc(to.AddDays(1), zone), config.TimeZone, config.Currency);
    }
    public Task<string> CurrencyAsync(CancellationToken token) => context.TenantConfigurations.AsNoTracking().Select(x => x.Currency).SingleAsync(token);
    public Task<FinancePatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking().Where(x => x.Id == id).Select(x => new FinancePatient(x.Id, x.FirstName + " " + x.LastName, x.Status == Domain.Patients.PatientStatus.Active)).SingleOrDefaultAsync(token);
    public Task<FinanceTreatment?> FindTreatmentAsync(Guid id, CancellationToken token)
    {
        var tracked = context.ChangeTracker.Entries<Domain.Treatments.Treatment>().Select(x => x.Entity).SingleOrDefault(x => x.Id == id);
        if (tracked is not null) return Task.FromResult<FinanceTreatment?>(new(tracked.Id, tracked.PatientId, tracked.DoctorProfileId, tracked.TreatmentPlanId, tracked.TreatmentName, tracked.Status, tracked.Price, tracked.CompletedAt));
        return context.Treatments.AsNoTracking().Where(x => x.Id == id).Select(x => new FinanceTreatment(x.Id, x.PatientId, x.DoctorProfileId, x.TreatmentPlanId, x.TreatmentName, x.Status, x.Price, x.CompletedAt)).SingleOrDefaultAsync(token);
    }
    public Task<FinanceDoctorRule?> FindCompensationRuleAsync(Guid doctorId, DateOnly treatmentDate, CancellationToken token) => context.DoctorCompensations.AsNoTracking().Where(x => x.DoctorProfileId == doctorId && x.EffectiveFrom <= treatmentDate && (!x.EffectiveTo.HasValue || x.EffectiveTo >= treatmentDate)).OrderByDescending(x => x.EffectiveFrom).Select(x => new FinanceDoctorRule(x.Id, x.CompensationType, x.FixedAmount, x.Percentage, x.EffectiveFrom, x.EffectiveTo)).FirstOrDefaultAsync(token);
    public Task<FinancialCategory?> FindCategoryAsync(Guid id, bool tracking, CancellationToken token) => (tracking ? context.FinancialCategories.AsQueryable() : context.FinancialCategories.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public Task<FinancialCategory?> FindCategoryByCodeAsync(string code, FinancialCategoryType type, CancellationToken token) => context.FinancialCategories.SingleOrDefaultAsync(x => x.Code == code && x.Type == type && x.IsActive, token);
    public Task<bool> CategoryCodeExistsAsync(string code, Guid? excludeId, CancellationToken token) => context.FinancialCategories.AnyAsync(x => x.Code == code && (!excludeId.HasValue || x.Id != excludeId), token);
    public async Task<bool> CategoryHasReferencesAsync(Guid id, CancellationToken token) =>
        await context.Revenues.AnyAsync(x => x.CategoryId == id, token) || await context.Expenses.AnyAsync(e => e.CategoryId == id, token);
    public async Task<bool> CategoryCreatesCycleAsync(Guid id, Guid? parentId, CancellationToken token)
    { if (id == Guid.Empty || !parentId.HasValue) return false; var current = parentId; for (var i = 0; i < 50 && current.HasValue; i++) { if (current == id) return true; current = await context.FinancialCategories.AsNoTracking().Where(x => x.Id == current.Value).Select(x => x.ParentId).SingleOrDefaultAsync(token); } return current.HasValue; }
    public async Task<IReadOnlyCollection<FinancialCategoryItem>> CategoriesAsync(bool includeInactive, FinancialCategoryType? type, CancellationToken token)
    { var q = context.FinancialCategories.AsNoTracking(); if (!includeInactive) q = q.Where(x => x.IsActive); if (type.HasValue) q = q.Where(x => x.Type == type); return await q.OrderBy(x => x.Type).ThenBy(x => x.Name).Select(x => new FinancialCategoryItem(x.Id, x.Name, x.Code, x.Type, x.ParentId, context.FinancialCategories.Where(p => p.Id == x.ParentId).Select(p => p.Name).FirstOrDefault(), x.IsActive, x.CreatedAt, x.UpdatedAt, x.Version)).ToListAsync(token); }
    public Task<Revenue?> FindRevenueAsync(Guid id, CancellationToken token) => context.Revenues.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token);
    public Task<Revenue?> FindRevenueByTreatmentAsync(Guid treatmentId, CancellationToken token) => context.Revenues.AsNoTracking().SingleOrDefaultAsync(x => x.TreatmentId == treatmentId, token);
    public Task<RevenueItem?> RevenueAsync(Guid id, CancellationToken token) => RevenueProjection(context.Revenues.AsNoTracking().Where(x => x.Id == id)).SingleOrDefaultAsync(token);

    public async Task<FinanceSummary> DashboardAsync(FinanceRange range, CancellationToken token)
    {
        var revenues = context.Revenues.AsNoTracking().Where(x => x.OccurredAt >= range.From && x.OccurredAt < range.To);
        var revenue = await revenues.SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var payments = await context.Payments.AsNoTracking().Where(x => x.PaidAt >= range.From && x.PaidAt < range.To).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var paidAgainstRevenue = await context.Payments.AsNoTracking().Where(p => context.Revenues.Any(r => r.Id == p.RevenueId && r.OccurredAt >= range.From && r.OccurredAt < range.To)).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var expenses = await context.Expenses.AsNoTracking().Where(x => x.ExpenseDate >= range.From && x.ExpenseDate < range.To).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var compensation = await context.DoctorCompensationCosts.AsNoTracking().Where(x => x.OccurredAt >= range.From && x.OccurredAt < range.To).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var revenueCategoryRows = await (from r in revenues join c in context.FinancialCategories.AsNoTracking() on r.CategoryId equals c.Id group r by new { c.Id, c.Name } into g select new { g.Key.Id, g.Key.Name, Amount = g.Sum(x => x.Amount) }).OrderByDescending(x => x.Amount).ToListAsync(token);
        var revenueByCategory = revenueCategoryRows.Select(x => new FinanceNamedAmount(x.Id, x.Name, x.Amount)).ToArray();
        var revenueDoctorRows = await (from r in revenues where r.DoctorProfileId.HasValue join d in context.DoctorProfiles.AsNoTracking() on r.DoctorProfileId equals d.Id join u in context.ClinicUsers.AsNoTracking() on d.ClinicUserId equals u.Id group r by new { d.Id, u.DisplayName } into g select new { g.Key.Id, Name = g.Key.DisplayName, Amount = g.Sum(x => x.Amount) }).OrderByDescending(x => x.Amount).ToListAsync(token);
        var revenueByDoctor = revenueDoctorRows.Select(x => new FinanceNamedAmount(x.Id, x.Name, x.Amount)).ToArray();
        var expenseQuery = context.Expenses.AsNoTracking().Where(x => x.ExpenseDate >= range.From && x.ExpenseDate < range.To);
        var expenseCategoryRows = await (from e in expenseQuery join c in context.FinancialCategories.AsNoTracking() on e.CategoryId equals c.Id group e by new { c.Id, c.Name } into g select new { g.Key.Id, g.Key.Name, Amount = g.Sum(x => x.Amount) }).OrderByDescending(x => x.Amount).ToListAsync(token);
        var expenseByCategory = expenseCategoryRows.Select(x => new FinanceNamedAmount(x.Id, x.Name, x.Amount)).ToArray();
        var tenantId = currentTenant.RequireTenantId();
        var revenueDayRows = await context.Database.SqlQuery<DailyTotal>($"""
            SELECT local_date AS "Date", SUM(amount) AS "Amount" FROM (
                SELECT ("OccurredAt" AT TIME ZONE {range.TimeZone})::date AS local_date, "Amount" AS amount
                FROM revenues WHERE "TenantId" = {tenantId} AND "OccurredAt" >= {range.From} AND "OccurredAt" < {range.To}
            ) daily GROUP BY local_date ORDER BY local_date
            """).ToListAsync(token);
        var expenseDayRows = await context.Database.SqlQuery<DailyTotal>($"""
            SELECT local_date AS "Date", SUM(amount) AS "Amount" FROM (
                SELECT ("ExpenseDate" AT TIME ZONE {range.TimeZone})::date AS local_date, "Amount" AS amount
                FROM expenses WHERE "TenantId" = {tenantId} AND "ExpenseDate" >= {range.From} AND "ExpenseDate" < {range.To}
            ) daily GROUP BY local_date ORDER BY local_date
            """).ToListAsync(token);
        var revenueByDay = revenueDayRows.Select(x => new FinanceDailyAmount(x.Date, x.Amount)).ToArray();
        var expenseByDay = expenseDayRows.Select(x => new FinanceDailyAmount(x.Date, x.Amount)).ToArray();
        return new(revenue, payments, revenue - paidAgainstRevenue, expenses, compensation, revenue - expenses - compensation, range.Currency, range.From, range.To, range.TimeZone, revenueByCategory, revenueByDoctor, expenseByCategory, revenueByDay, expenseByDay);
    }
    public async Task<PagedResult<RevenueItem>> RevenuesAsync(RevenueSearch x, FinanceRange range, CancellationToken token)
    { var q = context.Revenues.AsNoTracking().Where(r => r.OccurredAt >= range.From && r.OccurredAt < range.To); if (!string.IsNullOrWhiteSpace(x.Search)) q = q.Where(r => EF.Functions.ILike(r.Description, $"%{x.Search}%")); if (x.PatientId.HasValue) q = q.Where(r => r.PatientId == x.PatientId); if (x.DoctorProfileId.HasValue) q = q.Where(r => r.DoctorProfileId == x.DoctorProfileId); if (x.TreatmentId.HasValue) q = q.Where(r => r.TreatmentId == x.TreatmentId); if (x.CategoryId.HasValue) q = q.Where(r => r.CategoryId == x.CategoryId); var total = await q.CountAsync(token); var items = await RevenueProjection(q.OrderByDescending(r => r.OccurredAt).Skip((x.Page - 1) * x.PageSize).Take(x.PageSize)).ToListAsync(token); return new(items, x.Page, x.PageSize, total); }
    public async Task<PagedResult<PaymentItem>> PaymentsAsync(PaymentSearch x, FinanceRange range, CancellationToken token)
    { var q = context.Payments.AsNoTracking().Where(p => p.PaidAt >= range.From && p.PaidAt < range.To); if (x.PatientId.HasValue) q = q.Where(p => p.PatientId == x.PatientId); if (x.RevenueId.HasValue) q = q.Where(p => p.RevenueId == x.RevenueId); if (x.TreatmentId.HasValue) q = q.Where(p => p.TreatmentId == x.TreatmentId); var total = await q.CountAsync(token); var items = await q.OrderByDescending(p => p.PaidAt).Skip((x.Page - 1) * x.PageSize).Take(x.PageSize).Select(p => new PaymentItem(p.Id, p.PatientId, context.Patients.Where(a => a.Id == p.PatientId).Select(a => a.FirstName + " " + a.LastName).FirstOrDefault(), p.RevenueId, p.TreatmentId, p.Amount, p.Currency, p.PaymentMethod, p.Reference, p.PaidAt, p.CreatedAt)).ToListAsync(token); return new(items, x.Page, x.PageSize, total); }
    public async Task<PagedResult<ExpenseItem>> ExpensesAsync(ExpenseSearch x, FinanceRange range, CancellationToken token)
    { var q = context.Expenses.AsNoTracking().Where(e => e.ExpenseDate >= range.From && e.ExpenseDate < range.To); if (x.CategoryId.HasValue) q = q.Where(e => e.CategoryId == x.CategoryId); var total = await q.CountAsync(token); var items = await q.OrderByDescending(e => e.ExpenseDate).Skip((x.Page - 1) * x.PageSize).Take(x.PageSize).Select(e => new ExpenseItem(e.Id, e.CategoryId, context.FinancialCategories.Where(c => c.Id == e.CategoryId).Select(c => c.Name).Single(), e.Amount, e.Currency, e.Description, e.VendorName, e.Reference, e.ExpenseDate, e.CreatedAt)).ToListAsync(token); return new(items, x.Page, x.PageSize, total); }
    public async Task<PatientBalance?> PatientBalanceAsync(Guid patientId, CancellationToken token)
    { if (!await context.Patients.AnyAsync(x => x.Id == patientId, token)) return null; var revenue = await context.Revenues.Where(x => x.PatientId == patientId).SumAsync(x => (decimal?)x.Amount, token) ?? 0; var paid = await context.Payments.Where(x => x.PatientId == patientId).SumAsync(x => (decimal?)x.Amount, token) ?? 0; return new(patientId, revenue, paid, revenue - paid, await CurrencyAsync(token)); }
    public async Task<decimal> PaidForRevenueAsync(Guid revenueId, CancellationToken token) => await context.Payments.Where(x => x.RevenueId == revenueId).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
    public async Task<IFinanceTransaction> BeginTransactionAsync(CancellationToken token) => new FinanceTransaction(await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token));
    public async Task LockRevenueAsync(Guid revenueId, CancellationToken token) { _ = await context.Revenues.FromSqlInterpolated($"SELECT * FROM revenues WHERE \"Id\" = {revenueId} FOR UPDATE").AsNoTracking().SingleOrDefaultAsync(token) ?? throw new FinanceNotFoundException("Revenue was not found."); }
    public void AddCategory(FinancialCategory x) => context.FinancialCategories.Add(x); public void AddRevenue(Revenue x) => context.Revenues.Add(x); public void AddPayment(Payment x) => context.Payments.Add(x); public void AddExpense(Expense x) => context.Expenses.Add(x); public void AddDoctorCost(DoctorCompensationCost x) => context.DoctorCompensationCosts.Add(x); public void AddTransaction(FinancialTransaction x) => context.FinancialTransactions.Add(x); public void AddAudit(PlatformAuditLog x) => context.PlatformAuditLogs.Add(x);
    public async Task SaveChangesAsync(CancellationToken token) { try { await context.SaveChangesAsync(token); } catch (DbUpdateConcurrencyException) { throw new FinanceConcurrencyException("The financial record changed. Reload it before continuing."); } catch (DbUpdateException x) when (x.InnerException is PostgresException p && p.SqlState == PostgresErrorCodes.UniqueViolation) { throw new FinanceConflictException("The financial source has already been posted."); } }
    private IQueryable<RevenueItem> RevenueProjection(IQueryable<Revenue> q) => q.Select(r => new RevenueItem(r.Id, r.CategoryId, context.FinancialCategories.Where(c => c.Id == r.CategoryId).Select(c => c.Name).Single(), r.PatientId, context.Patients.Where(p => p.Id == r.PatientId).Select(p => p.FirstName + " " + p.LastName).FirstOrDefault(), r.TreatmentId, context.Treatments.Where(t => t.Id == r.TreatmentId).Select(t => t.TreatmentName).FirstOrDefault(), r.DoctorProfileId, context.DoctorProfiles.Where(d => d.Id == r.DoctorProfileId).Select(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName).Single()).FirstOrDefault(), r.Amount, context.Payments.Where(p => p.RevenueId == r.Id).Sum(p => (decimal?)p.Amount) ?? 0, r.Amount - (context.Payments.Where(p => p.RevenueId == r.Id).Sum(p => (decimal?)p.Amount) ?? 0), r.Currency, r.Description, r.OccurredAt));
    private static DateTimeOffset ToUtc(DateOnly date, TimeZoneInfo zone) => new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone), TimeSpan.Zero);
    private sealed class FinanceTransaction(IDbContextTransaction transaction) : IFinanceTransaction { public Task CommitAsync(CancellationToken token) => transaction.CommitAsync(token); public ValueTask DisposeAsync() => transaction.DisposeAsync(); }
    private sealed class DailyTotal { public DateOnly Date { get; init; } public decimal Amount { get; init; } }
}
