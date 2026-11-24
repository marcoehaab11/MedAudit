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
    public async Task<DoctorDues?> MyDuesAsync(Guid userId, CancellationToken token)
    {
        var doctorId = await context.DoctorProfiles.AsNoTracking().Where(x => x.ClinicUserId == userId)
            .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(token);
        if (!doctorId.HasValue) return null;
        return (await DoctorDuesAsync([doctorId.Value], token))[doctorId.Value];
    }

    public async Task<IReadOnlyDictionary<Guid, DoctorDues>> DoctorDuesAsync(IReadOnlyCollection<Guid> ids, CancellationToken token)
    {
        if (ids.Count == 0) return new Dictionary<Guid, DoctorDues>();
        var balances = await context.DoctorCompensationCosts.AsNoTracking()
            .Where(x => ids.Contains(x.DoctorProfileId))
            .GroupBy(x => new { x.DoctorProfileId, x.Currency })
            .Select(g => new
            {
                g.Key.DoctorProfileId,
                g.Key.Currency,
                Total = g.Sum(x => x.Amount),
                TreatmentCount = g.Select(x => x.TreatmentId).Distinct().Count(),
            }).ToArrayAsync(token);
        var currency = await CurrencyAsync(token);
        var byDoctor = balances.ToLookup(x => x.DoctorProfileId);
        return ids.Distinct().ToDictionary(id => id, id =>
        {
            var rows = byDoctor[id].OrderBy(x => x.Currency)
                .Select(x => new DoctorDuesCurrency(x.Currency, x.Total, x.TreatmentCount)).ToArray();
            return new DoctorDues(rows.FirstOrDefault(x => x.Currency == currency)?.Total ?? 0,
                currency, rows.Sum(x => x.TreatmentCount), rows);
        });
    }

    public async Task<IReadOnlyCollection<BillingQueueItem>> BillingQueueAsync(CancellationToken token)
    {
        return await (from revenue in context.Revenues.AsNoTracking()
                      join patient in context.Patients.AsNoTracking() on revenue.PatientId equals (Guid?)patient.Id
                      let completedAt = context.Treatments.Where(t => t.Status == DentalClinic.Domain.Treatments.TreatmentStatus.Completed &&
                          (t.Id == revenue.TreatmentId || revenue.TreatmentPlanId.HasValue && t.TreatmentPlanId == revenue.TreatmentPlanId))
                          .Max(t => (DateTimeOffset?)t.CompletedAt)
                      where completedAt.HasValue
                      let paid = context.Payments.Where(p => p.RevenueId == revenue.Id).Sum(p => (decimal?)p.Amount) ?? 0
                      where revenue.Amount > paid
                      orderby completedAt descending
                      select new BillingQueueItem(revenue.Id, patient.Id, patient.FirstName + " " + patient.LastName,
                          revenue.Description, revenue.Amount - paid, revenue.Currency, null, completedAt.Value, patient.PatientNumber))
                     .Take(100).ToListAsync(token);
    }
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
            case FinancePeriod.LastMonth: to = new DateOnly(today.Year, today.Month, 1).AddDays(-1); from = new(to.Year, to.Month, 1); break;
            case FinancePeriod.ThisYear: from = new(today.Year, 1, 1); to = today; break;
            case FinancePeriod.Custom: from = filter.From ?? new DateOnly(1900, 1, 1); to = filter.To ?? new DateOnly(2200, 12, 31); break;
            default: throw new ArgumentException("Invalid finance period.");
        }
        if (from > to) throw new ArgumentException("From date cannot exceed to date.");
        return new(ToUtc(from, zone), ToUtc(to.AddDays(1), zone), config.TimeZone, config.Currency)
        {
            Comparison = filter.IncludeComparison ? ResolveComparison(filter, from, to, zone) : null,
        };
    }

    private static FinanceComparisonRange? ResolveComparison(FinanceDateFilter filter, DateOnly from, DateOnly to, TimeZoneInfo zone)
    {
        var dayCount = to.DayNumber - from.DayNumber + 1;
        if (filter.Period == FinancePeriod.Custom &&
            (filter.From is null || filter.To is null || from.DayNumber <= dayCount))
            return null;

        var previousFrom = filter.Period switch
        {
            FinancePeriod.ThisMonth or FinancePeriod.LastMonth => from.AddMonths(-1),
            FinancePeriod.ThisYear => from.AddYears(-1),
            _ => from.AddDays(-dayCount),
        };
        var previousTo = filter.Period switch
        {
            FinancePeriod.ThisMonth => to.AddMonths(-1),
            FinancePeriod.ThisYear => to.AddYears(-1),
            _ => from.AddDays(-1),
        };
        return new(ToUtc(previousFrom, zone), ToUtc(previousTo.AddDays(1), zone), previousFrom, previousTo);
    }
    public Task<string> CurrencyAsync(CancellationToken token) => context.TenantConfigurations.AsNoTracking().Select(x => x.Currency).SingleAsync(token);
    public Task<FinancePatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking().Where(x => x.Id == id).Select(x => new FinancePatient(x.Id, x.FirstName + " " + x.LastName, x.Status == Domain.Patients.PatientStatus.Active)).SingleOrDefaultAsync(token);
    public Task<FinanceTreatment?> FindTreatmentAsync(Guid id, CancellationToken token)
    {
        var tracked = context.ChangeTracker.Entries<Domain.Treatments.Treatment>().Select(x => x.Entity).SingleOrDefault(x => x.Id == id);
        if (tracked is not null) return Task.FromResult<FinanceTreatment?>(new(tracked.Id, tracked.PatientId, tracked.DoctorProfileId, tracked.TreatmentPlanId, tracked.TreatmentName, tracked.Status, tracked.Price, tracked.CompletedAt, tracked.CreatedAt, tracked.Type, tracked.IsClinicalFlowContainer, tracked.ParentTreatmentId.HasValue, tracked.PriceConfirmed));
        return context.Treatments.AsNoTracking().Where(x => x.Id == id).Select(x => new FinanceTreatment(x.Id, x.PatientId, x.DoctorProfileId, x.TreatmentPlanId, x.TreatmentName, x.Status, x.Price, x.CompletedAt, x.CreatedAt, x.Type, x.IsClinicalFlowContainer, x.ParentTreatmentId.HasValue, x.PriceConfirmed)).SingleOrDefaultAsync(token);
    }
    public Task<FinanceDoctorRule?> CompensationRuleByIdAsync(Guid id, CancellationToken token) =>
        context.DoctorCompensations.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new FinanceDoctorRule(x.Id, x.CompensationType, x.FixedAmount, x.Percentage,
                x.EffectiveFrom, x.EffectiveTo, x.CommissionBasis)).SingleOrDefaultAsync(token);
    public Task<FinanceDoctorRule?> FindCompensationRuleAsync(Guid doctorId, DateOnly treatmentDate, CancellationToken token) => context.DoctorCompensations.AsNoTracking().Where(x => x.DoctorProfileId == doctorId && x.EffectiveFrom <= treatmentDate && (!x.EffectiveTo.HasValue || x.EffectiveTo >= treatmentDate)).OrderByDescending(x => x.EffectiveFrom).Select(x => new FinanceDoctorRule(x.Id, x.CompensationType, x.FixedAmount, x.Percentage, x.EffectiveFrom, x.EffectiveTo, x.CommissionBasis)).FirstOrDefaultAsync(token);
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
    public Task<Revenue?> FindRevenueByPlanAsync(Guid planId, CancellationToken token) => context.Revenues.SingleOrDefaultAsync(x => x.TreatmentPlanId == planId && x.TreatmentId == null, token);
    public Task<Domain.Treatments.TreatmentPlan?> FindPlanForRevenueAsync(Guid planId, CancellationToken token) => context.TreatmentPlans.SingleOrDefaultAsync(x => x.Id == planId, token);
    public async Task<Revenue?> FindLatestOutstandingRevenueByPatientAsync(Guid patientId, CancellationToken token)
    {
        var revenues = await context.Revenues.Where(r => r.PatientId == patientId).OrderByDescending(r => r.OccurredAt).ToListAsync(token);
        foreach (var r in revenues)
        {
            var paid = await context.Payments.Where(p => p.RevenueId == r.Id).SumAsync(p => (decimal?)p.Amount, token) ?? 0;
            if (r.Amount > paid) return r;
        }
        return revenues.FirstOrDefault();
    }
    public Task<RevenueItem?> RevenueAsync(Guid id, CancellationToken token) => RevenueProjection(context.Revenues.AsNoTracking().Where(x => x.Id == id)).SingleOrDefaultAsync(token);

    public async Task<FinanceSummary> DashboardAsync(FinanceRange range, CancellationToken token)
    {
        var revenues = context.Revenues.AsNoTracking().Where(x => x.OccurredAt >= range.From && x.OccurredAt < range.To);
        var revenue = await revenues.SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        FinanceRevenueComparison? revenueComparison = null;
        if (range.Comparison is { } comparison)
        {
            var previousRevenue = await context.Revenues.AsNoTracking()
                .Where(x => x.OccurredAt >= comparison.From && x.OccurredAt < comparison.To)
                .SumAsync(x => (decimal?)x.Amount, token) ?? 0;
            revenueComparison = new(previousRevenue, comparison.FromDate, comparison.ToDate);
        }
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
        return new(revenue, payments, revenue - paidAgainstRevenue, expenses, compensation, revenue - expenses - compensation, range.Currency, range.From, range.To, range.TimeZone, revenueByCategory, revenueByDoctor, expenseByCategory, revenueByDay, expenseByDay)
        {
            RevenueComparison = revenueComparison,
        };
    }
    public async Task<RevenuePage> RevenuesAsync(RevenueSearch x, FinanceRange range, CancellationToken token)
    {
        var query = context.Revenues.AsNoTracking().Where(r => r.OccurredAt >= range.From && r.OccurredAt < range.To);
        if (!string.IsNullOrWhiteSpace(x.Search))
        {
            var pattern = $"%{x.Search}%";
            query = query.Where(r => EF.Functions.ILike(r.Description, pattern) ||
                x.SearchTreatmentNotes && context.Treatments.Any(t => t.Id == r.TreatmentId &&
                    (!x.TreatmentNotesDoctorId.HasValue || t.DoctorProfileId == x.TreatmentNotesDoctorId) &&
                    t.Notes != null && EF.Functions.ILike(t.Notes, pattern)) ||
                x.SearchPaymentNotes && context.Payments.Any(p => p.RevenueId == r.Id &&
                    p.Notes != null && EF.Functions.ILike(p.Notes, pattern)));
        }
        if (x.PatientId.HasValue) query = query.Where(r => r.PatientId == x.PatientId);
        if (x.DoctorProfileId.HasValue) query = query.Where(r => r.DoctorProfileId == x.DoctorProfileId);
        if (x.TreatmentId.HasValue) query = query.Where(r => r.TreatmentId == x.TreatmentId);
        if (x.CategoryId.HasValue) query = query.Where(r => r.CategoryId == x.CategoryId);

        // The table and totals must agree even when a payment posts during the request.
        await using var snapshot = x.IncludeSummary
            ? await context.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token)
            : null;
        var total = await query.CountAsync(token);
        var items = await RevenueProjection(query.OrderByDescending(r => r.OccurredAt).ThenByDescending(r => r.Id)
            .Skip((x.Page - 1) * x.PageSize).Take(x.PageSize)).ToListAsync(token);
        var summary = x.IncludeSummary ? await SummarizeRevenuesAsync(query, range.Currency, token) : null;
        if (snapshot is not null) await snapshot.CommitAsync(token);
        return new(items, x.Page, x.PageSize, total, summary);
    }

    private async Task<RevenueResultsSummary> SummarizeRevenuesAsync(
        IQueryable<Revenue> query, string currency, CancellationToken token)
    {
        var amounts = await query.GroupBy(r => r.Currency)
            .Select(g => new
            {
                Currency = g.Key,
                Revenue = g.Sum(r => r.Amount),
                Paid = g.Sum(r => context.Payments.Where(p => p.RevenueId == r.Id).Sum(p => (decimal?)p.Amount) ?? 0),
            }).ToListAsync(token);
        var totals = amounts.OrderByDescending(x => x.Currency == currency).ThenBy(x => x.Currency)
            .Select(x => new RevenueCurrencyTotals(x.Currency, x.Revenue, x.Paid, x.Revenue - x.Paid)).ToArray();

        var services = await (from r in query
                              join t in context.Treatments on r.TreatmentId equals (Guid?)t.Id
                              join c in context.TreatmentCatalogItems on t.TreatmentCatalogItemId equals c.Id
                              group r by new { c.Id, c.Name, c.Type, r.Currency } into g
                              select new RevenueServiceTotal(g.Key.Id, g.Key.Name, g.Key.Type, g.Key.Currency, g.Sum(r => r.Amount)))
            .ToListAsync(token);
        var ranked = services.OrderByDescending(s => s.Currency == currency).ThenBy(s => s.Currency)
            .ThenByDescending(s => s.Revenue).ThenBy(s => s.Name).ThenBy(s => s.CatalogItemId).ToArray();
        return new(totals.Length == 0 ? [new(currency, 0, 0, 0)] : totals, ranked);
    }
    public async Task<PagedResult<PaymentItem>> PaymentsAsync(PaymentSearch x, FinanceRange range, CancellationToken token)
    { var q = context.Payments.AsNoTracking().Where(p => p.PaidAt >= range.From && p.PaidAt < range.To); if (x.PatientId.HasValue) q = q.Where(p => p.PatientId == x.PatientId); if (x.RevenueId.HasValue) q = q.Where(p => p.RevenueId == x.RevenueId); if (x.TreatmentId.HasValue) q = q.Where(p => p.TreatmentId == x.TreatmentId); var total = await q.CountAsync(token); var items = await q.OrderByDescending(p => p.PaidAt).Skip((x.Page - 1) * x.PageSize).Take(x.PageSize).Select(p => new PaymentItem(p.Id, p.PatientId, context.Patients.Where(a => a.Id == p.PatientId).Select(a => a.FirstName + " " + a.LastName).FirstOrDefault(), p.RevenueId, p.TreatmentId, p.Amount, p.Currency, p.PaymentMethod, p.Reference, p.PaidAt, p.CreatedAt)).ToListAsync(token); return new(items, x.Page, x.PageSize, total); }
    public async Task<PagedResult<ExpenseItem>> ExpensesAsync(ExpenseSearch x, FinanceRange range, CancellationToken token)
    {
        var query = context.Expenses.AsNoTracking().Where(e => e.ExpenseDate >= range.From && e.ExpenseDate < range.To);
        if (x.CategoryId.HasValue) query = query.Where(e => e.CategoryId == x.CategoryId);
        var total = await query.CountAsync(token);
        var items = await query.OrderByDescending(e => e.ExpenseDate).ThenByDescending(e => e.Id)
            .Skip((x.Page - 1) * x.PageSize).Take(x.PageSize)
            .Select(e => new ExpenseItem(e.Id, e.CategoryId,
                context.FinancialCategories.Where(c => c.Id == e.CategoryId).Select(c => c.Name).Single(),
                e.Amount, e.Currency, e.Description, e.VendorName, e.Reference, e.ExpenseDate, e.CreatedAt,
                context.FixedExpensesDue.Any(d => d.ExpenseId == e.Id))).ToListAsync(token);
        return new(items, x.Page, x.PageSize, total);
    }
    public async Task<PatientBalance?> PatientBalanceAsync(Guid patientId, CancellationToken token)
    {
        if (!await context.Patients.AnyAsync(x => x.Id == patientId, token)) return null;

        var unbilledTreatments = await context.Treatments
            .Where(t => t.PatientId == patientId && t.PriceConfirmed && t.Price > 0 && !t.IsClinicalFlowContainer && t.Status == Domain.Treatments.TreatmentStatus.Completed && (!t.TreatmentPlanId.HasValue || !context.Revenues.Any(r => r.TreatmentPlanId == t.TreatmentPlanId && r.TreatmentId == null)) && !context.Revenues.Any(r => r.TreatmentId == t.Id))
            .ToListAsync(token);
        if (unbilledTreatments.Count > 0)
        {
            var category = await context.FinancialCategories.FirstOrDefaultAsync(c => c.Code == "TREATMENT_REVENUE" && c.Type == FinancialCategoryType.Revenue && c.IsActive, token)
                ?? await context.FinancialCategories.FirstOrDefaultAsync(c => c.Type == FinancialCategoryType.Revenue && c.IsActive, token);
            if (category is not null)
            {
                var currency = await CurrencyAsync(token);
                var now = clock.UtcNow;
                foreach (var tr in unbilledTreatments)
                {
                    var occAt = tr.CompletedAt ?? tr.CreatedAt;
                    var rev = new Revenue(currentTenant.RequireTenantId(), category.Id, tr.PatientId, tr.Id, tr.TreatmentPlanId, tr.DoctorProfileId, tr.Price, currency, tr.TreatmentName, occAt, now);
                    context.Revenues.Add(rev);
                    context.FinancialTransactions.Add(new(rev.TenantId, FinancialTransactionType.Revenue, rev.Amount, rev.Currency, rev.OccurredAt, FinancialSourceType.Revenue, rev.Id, rev.Description, now));
                }
                await context.SaveChangesAsync(token);
            }
        }

        var revenue = await context.Revenues.Where(x => x.PatientId == patientId).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        var paid = await context.Payments.Where(x => x.PatientId == patientId).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
        return new(patientId, revenue, paid, revenue - paid, await CurrencyAsync(token));
    }
    public async Task<decimal> PaidForRevenueAsync(Guid revenueId, CancellationToken token) => await context.Payments.Where(x => x.RevenueId == revenueId).SumAsync(x => (decimal?)x.Amount, token) ?? 0;
    public async Task<IFinanceTransaction> BeginTransactionAsync(CancellationToken token) => new FinanceTransaction(await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token));
    public async Task LockRevenueAsync(Guid revenueId, CancellationToken token) { _ = await context.Revenues.FromSqlInterpolated($"SELECT * FROM revenues WHERE \"Id\" = {revenueId} FOR UPDATE").AsNoTracking().SingleOrDefaultAsync(token) ?? throw new FinanceNotFoundException("Revenue was not found."); }
    public Task<FixedExpenseDue?> LockFixedExpenseDueAsync(Guid id, CancellationToken token) =>
        context.FixedExpensesDue.FromSqlInterpolated($"SELECT * FROM fixed_expenses_due WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(token);
    public Task<FixedExpenseSchedule> FixedExpenseScheduleAsync(Guid id, CancellationToken token) =>
        context.FixedExpenseSchedules.AsNoTracking().SingleAsync(x => x.Id == id, token);
    public void AddCategory(FinancialCategory x) => context.FinancialCategories.Add(x); public void AddRevenue(Revenue x) => context.Revenues.Add(x); public void AddPayment(Payment x) => context.Payments.Add(x); public void AddExpense(Expense x) => context.Expenses.Add(x); public void AddDoctorCost(DoctorCompensationCost x) => context.DoctorCompensationCosts.Add(x); public void AddTransaction(FinancialTransaction x) => context.FinancialTransactions.Add(x); public void AddAudit(PlatformAuditLog x) => context.PlatformAuditLogs.Add(x);
    public async Task SaveChangesAsync(CancellationToken token) { try { await context.SaveChangesAsync(token); } catch (DbUpdateConcurrencyException) { throw new FinanceConcurrencyException("The financial record changed. Reload it before continuing."); } catch (DbUpdateException x) when (x.InnerException is PostgresException p && p.SqlState == PostgresErrorCodes.UniqueViolation) { throw new FinanceConflictException("The financial source has already been posted."); } }
    private IQueryable<RevenueItem> RevenueProjection(IQueryable<Revenue> query) =>
        from r in query
        join patient in context.Patients on r.PatientId equals (Guid?)patient.Id into patients
        from p in patients.DefaultIfEmpty()
        join treatment in context.Treatments on r.TreatmentId equals (Guid?)treatment.Id into treatments
        from t in treatments.DefaultIfEmpty()
        join catalog in context.TreatmentCatalogItems on t.TreatmentCatalogItemId equals catalog.Id into catalogs
        from c in catalogs.DefaultIfEmpty()
        let paid = context.Payments.Where(p => p.RevenueId == r.Id).Sum(p => (decimal?)p.Amount) ?? 0
        select new RevenueItem(r.Id, r.CategoryId,
            context.FinancialCategories.Where(category => category.Id == r.CategoryId).Select(category => category.Name).Single(),
            r.PatientId, p == null ? null : (p.FirstName + " " + (p.MiddleName ?? "") + " " + p.LastName).Replace("  ", " "),
            r.TreatmentId, t == null ? null : t.TreatmentName,
            r.DoctorProfileId, context.DoctorProfiles.Where(d => d.Id == r.DoctorProfileId)
                .Select(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName).Single()).FirstOrDefault(),
            r.Amount, paid, r.Amount - paid, r.Currency, r.Description, r.OccurredAt,
            p == null ? null : p.PatientNumber, c == null ? null : c.Type);
    private static DateTimeOffset ToUtc(DateOnly date, TimeZoneInfo zone) => new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone), TimeSpan.Zero);
    private sealed class FinanceTransaction(IDbContextTransaction transaction) : IFinanceTransaction { public Task CommitAsync(CancellationToken token) => transaction.CommitAsync(token); public ValueTask DisposeAsync() => transaction.DisposeAsync(); }
    private sealed class DailyTotal { public DateOnly Date { get; init; } public decimal Amount { get; init; } }
}
