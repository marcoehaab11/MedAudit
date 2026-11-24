
using System.Data;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.ClinicBusiness;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DentalClinic.Infrastructure.Services;

public sealed record FixedExpenseInput(string Name, Guid CategoryId, string Beneficiary,
    decimal MonthlyAmount, int DueDay, DateOnly StartsOn);
public sealed record FixedExpenseScheduleItem(Guid Id, string Name, Guid CategoryId, string Beneficiary,
    decimal MonthlyAmount, int DueDay, DateOnly StartsOn, string Currency);

public sealed record DueExpenseItem(Guid Id, DateOnly DueDate, bool IsFixed, Guid? CategoryId, string CategoryName,
    string Description, string? VendorName, decimal Amount, string Currency, Guid? LabPatientId, Guid? LabStatementId);
public sealed record ExpenseLedger(PagedResult<ExpenseItem> Paid, PagedResult<DueExpenseItem> Due);

public sealed class ExpenseObligationsService(ApplicationDbContext db, ICurrentTenant tenant, ISystemClock clock,
    IFinanceQueries finance)
{
    public async Task<ExpenseLedger> LedgerAsync(int paidPage, int duePage, CancellationToken token)
    {
        await using var snapshot = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        var paid = await finance.ExpensesAsync(new(Page: paidPage), token);
        var due = await DueAsync(duePage, 20, token);
        await snapshot.CommitAsync(token);
        return new(paid, due);
    }

    public async Task<FixedExpenseScheduleItem[]> SchedulesAsync(CancellationToken token)
    {
        var currency = await db.TenantConfigurations.Select(x => x.Currency).SingleAsync(token);
        return await db.FixedExpenseSchedules.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new FixedExpenseScheduleItem(x.Id, x.Name, x.CategoryId, x.Beneficiary,
                x.MonthlyAmount, x.DueDay, x.StartsOn, currency)).ToArrayAsync(token);
    }

    public async Task<Guid> AddScheduleAsync(FixedExpenseInput input, CancellationToken token)
    {
        if (!await db.FinancialCategories.AnyAsync(x => x.Id == input.CategoryId && x.IsActive &&
            x.Type == FinancialCategoryType.Expense, token))
            throw new ArgumentException("An active expense category is required.");
        var id = tenant.RequireTenantId();
        var schedule = new FixedExpenseSchedule(id, input.CategoryId, input.Name, input.Beneficiary,
            input.MonthlyAmount, input.DueDay, input.StartsOn);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        db.FixedExpenseSchedules.Add(schedule);
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new FinanceConflictException("A fixed expense with this name already exists.");
        }
        await GenerateMonthlyAsync(id, token);
        await transaction.CommitAsync(token);
        return schedule.Id;
    }

    public async Task<int> GenerateMonthlyAsync(Guid? tenantId, CancellationToken token)
    {
        var scopes = await db.TenantConfigurations.IgnoreQueryFilters()
            .Where(x => (!tenantId.HasValue || x.TenantId == tenantId) &&
                db.FixedExpenseSchedules.IgnoreQueryFilters().Any(s => s.TenantId == x.TenantId))
            .Select(x => new { x.TenantId, x.TimeZone, x.Currency }).ToArrayAsync(token);
        var now = clock.UtcNow;
        var generated = 0;
        foreach (var scope in scopes)
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(scope.TimeZone);
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime);
            generated += await GenerateForClinicAsync(scope.TenantId, scope.Currency, today, token);
        }
        return generated;
    }

    private Task<int> GenerateForClinicAsync(Guid tenantId, string currency, DateOnly today, CancellationToken token) =>
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO fixed_expenses_due ("Id", "TenantId", "ScheduleId", "Month", "DueDate", "Currency")
            SELECT gen_random_uuid(), s."TenantId", s."Id", months.month::date, dates.due_on, {currency}
            FROM fixed_expense_schedules s
            CROSS JOIN LATERAL (SELECT max(d."Month") AS last_month FROM fixed_expenses_due d
                WHERE d."TenantId" = s."TenantId" AND d."ScheduleId" = s."Id") previous
            CROSS JOIN LATERAL generate_series(
                coalesce(previous.last_month + interval '1 month', date_trunc('month', s."StartsOn"::timestamp)),
                date_trunc('month', CAST({today} AS timestamp)), interval '1 month') AS months(month)
            CROSS JOIN LATERAL (SELECT least(
                months.month::date + (s."DueDay" - 1),
                (months.month + interval '1 month')::date - 1) AS due_on) dates
            WHERE s."TenantId" = {tenantId} AND dates.due_on BETWEEN s."StartsOn" AND {today}
            ON CONFLICT ("TenantId", "ScheduleId", "Month") DO NOTHING
            """, token);

    public async Task<PagedResult<DueExpenseItem>> DueAsync(int page, int pageSize, CancellationToken token)
    {
        if (page < 1 || page > int.MaxValue / 100 || pageSize is < 1 or > 100)
            throw new ArgumentException("Invalid expense page.");
        var currency = await db.TenantConfigurations.Select(x => x.Currency).SingleAsync(token);
        var query = FixedDue().Concat(LabDue(currency));
        var count = await query.CountAsync(token);
        var items = await query.OrderByDescending(x => x.DueDate).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new DueExpenseItem(x.Id, x.DueDate, x.IsFixed, x.CategoryId, x.CategoryName,
                x.Description, x.VendorName, x.Amount, x.Currency, x.LabPatientId, x.LabStatementId))
            .ToArrayAsync(token);
        return new(items, page, pageSize, count);
    }

    public Task<DueExpenseItem?> FixedDueAsync(Guid id, CancellationToken token) => FixedDue()
        .Where(x => x.Id == id)
        .Select(x => new DueExpenseItem(x.Id, x.DueDate, x.IsFixed, x.CategoryId, x.CategoryName,
            x.Description, x.VendorName, x.Amount, x.Currency, x.LabPatientId, x.LabStatementId))
        .SingleOrDefaultAsync(token);

    private IQueryable<DueRow> FixedDue() =>
        from due in db.FixedExpensesDue.AsNoTracking()
        join schedule in db.FixedExpenseSchedules on due.ScheduleId equals schedule.Id
        join category in db.FinancialCategories on schedule.CategoryId equals category.Id
        where !due.ExpenseId.HasValue
        select new DueRow {
            Id = due.Id, DueDate = due.DueDate, IsFixed = true, CategoryId = schedule.CategoryId,
            CategoryName = category.Name, Description = schedule.Name, VendorName = schedule.Beneficiary,
            Amount = schedule.MonthlyAmount, Currency = due.Currency, LabPatientId = null, LabStatementId = null,
        };

    // A lab case already identifies the treatment, patient, vendor and agreed cost.
    // Its unpaid balance becomes due when the linked treatment is completed.
    private IQueryable<DueRow> LabDue(string currency) =>
        from lab in db.LabCases.AsNoTracking()
        join treatment in db.Treatments on lab.TreatmentId equals (Guid?)treatment.Id
        join vendor in db.LabVendors on lab.VendorId equals vendor.Id
        let paid = db.LabSettlements.Where(p => p.CaseId == lab.Id).Sum(p => (decimal?)p.Amount) ?? 0
        where treatment.Status == TreatmentStatus.Completed && treatment.CompletedAt.HasValue &&
            lab.Status != LabCaseStatus.Cancelled && lab.Cost > paid
        select new DueRow {
            Id = lab.Id, DueDate = DateOnly.FromDateTime(treatment.CompletedAt!.Value.UtcDateTime),
            IsFixed = false, CategoryId = null, CategoryName = "LAB_COST", Description = treatment.TreatmentName,
            VendorName = vendor.Name, Amount = lab.Cost - paid, Currency = currency,
            LabPatientId = lab.PatientId, LabStatementId = lab.StatementId,
        };

    private sealed class DueRow
    {
        public Guid Id { get; init; }
        public DateOnly DueDate { get; init; }
        public bool IsFixed { get; init; }
        public Guid? CategoryId { get; init; }
        public string CategoryName { get; init; } = "";
        public string Description { get; init; } = "";
        public string? VendorName { get; init; }
        public decimal Amount { get; init; }
        public string Currency { get; init; } = "";
        public Guid? LabPatientId { get; init; }
        public Guid? LabStatementId { get; init; }
    }
}
