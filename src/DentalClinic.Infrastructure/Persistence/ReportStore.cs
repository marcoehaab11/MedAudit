using System.Globalization;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Reports;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class ReportStore(ApplicationDbContext context, ISystemClock clock) : IReportStore
{
    public async Task<ReportRange> ResolveRangeAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var config = await context.TenantConfigurations.AsNoTracking()
            .Select(x => new { x.TimeZone, x.Currency })
            .SingleAsync(token);

        var zone = TimeZoneInfo.FindSystemTimeZoneById(config.TimeZone);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow, zone).DateTime);

        DateOnly from;
        DateOnly to;

        switch (filter.Period)
        {
            case ReportPeriod.Today:
                from = to = today;
                break;
            case ReportPeriod.ThisWeek:
                from = today.AddDays(-((7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7));
                to = today;
                break;
            case ReportPeriod.ThisMonth:
                from = new DateOnly(today.Year, today.Month, 1);
                to = today;
                break;
            case ReportPeriod.ThisYear:
                from = new DateOnly(today.Year, 1, 1);
                to = today;
                break;
            case ReportPeriod.Custom:
                from = filter.From ?? new DateOnly(1900, 1, 1);
                to = filter.To ?? new DateOnly(2200, 12, 31);
                break;
            default:
                throw new ArgumentException("Invalid report period.");
        }

        if (from > to)
        {
            throw new ArgumentException("From date cannot exceed to date.");
        }

        var fromUtc = ToUtc(from, zone);
        var toUtc = ToUtc(to.AddDays(1), zone);

        int days = (to.DayNumber - from.DayNumber) + 1;
        var prevFrom = from.AddDays(-days);
        var prevTo = to.AddDays(-days);

        var prevFromUtc = ToUtc(prevFrom, zone);
        var prevToUtc = ToUtc(prevTo.AddDays(1), zone);

        return new ReportRange(fromUtc, toUtc, prevFromUtc, prevToUtc, config.TimeZone, config.Currency);
    }

    private static DateTimeOffset ToUtc(DateOnly date, TimeZoneInfo zone)
    {
        var dt = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(dt, zone), TimeSpan.Zero);
    }

    public async Task<DashboardReportDto> GetDashboardReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var newPatients = await context.Patients.AsNoTracking()
            .CountAsync(p => p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtc, token);

        var apptQuery = context.Appointments.AsNoTracking()
            .Where(a => a.StartAt >= range.FromUtc && a.StartAt < range.ToUtc);
        if (doctorRestrictionId.HasValue)
        {
            apptQuery = apptQuery.Where(a => a.DoctorProfileId == doctorRestrictionId.Value);
        }

        var appts = await apptQuery
            .Select(a => a.Status)
            .ToListAsync(token);

        var apptsCount = appts.Count;
        var completedAppts = appts.Count(s => s == AppointmentStatus.Completed);
        var cancelledAppts = appts.Count(s => s == AppointmentStatus.Cancelled);
        var noShowAppts = appts.Count(s => s == AppointmentStatus.NoShow);

        var txQuery = context.Treatments.AsNoTracking()
            .Where(t => t.Status == TreatmentStatus.Completed && t.CompletedAt >= range.FromUtc && t.CompletedAt < range.ToUtc);
        if (doctorRestrictionId.HasValue)
        {
            txQuery = txQuery.Where(t => t.DoctorProfileId == doctorRestrictionId.Value);
        }
        var completedTreatments = await txQuery.CountAsync(token);

        var rxQuery = context.Prescriptions.AsNoTracking()
            .Where(p => p.Status == PrescriptionStatus.Issued && p.IssuedAt >= range.FromUtc && p.IssuedAt < range.ToUtc);
        if (doctorRestrictionId.HasValue)
        {
            rxQuery = rxQuery.Where(p => p.DoctorProfileId == doctorRestrictionId.Value);
        }
        var prescriptionsIssued = await rxQuery.CountAsync(token);

        var followUpsCompleted = await context.FollowUps.AsNoTracking()
            .CountAsync(f => f.Status == FollowUpStatus.Completed && f.UpdatedAt >= range.FromUtc && f.UpdatedAt < range.ToUtc, token);

        var revQuery = context.Revenues.AsNoTracking()
            .Where(r => r.OccurredAt >= range.FromUtc && r.OccurredAt < range.ToUtc);
        if (doctorRestrictionId.HasValue)
        {
            revQuery = revQuery.Where(r => r.DoctorProfileId == doctorRestrictionId.Value);
        }
        var revenue = await revQuery.SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

        var paymentsReceived = await context.Payments.AsNoTracking()
            .Where(p => p.PaidAt >= range.FromUtc && p.PaidAt < range.ToUtc)
            .SumAsync(p => (decimal?)p.Amount, token) ?? 0m;

        var outstanding = Math.Max(0m, revenue - paymentsReceived);

        var expenses = await context.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= range.FromUtc && e.ExpenseDate < range.ToUtc)
            .SumAsync(e => (decimal?)e.Amount, token) ?? 0m;

        var compQuery = context.DoctorCompensationCosts.AsNoTracking()
            .Where(c => c.OccurredAt >= range.FromUtc && c.OccurredAt < range.ToUtc);
        if (doctorRestrictionId.HasValue)
        {
            compQuery = compQuery.Where(c => c.DoctorProfileId == doctorRestrictionId.Value);
        }
        var doctorCompensation = await compQuery.SumAsync(c => (decimal?)c.Amount, token) ?? 0m;

        var netProfit = revenue - doctorCompensation - expenses;

        return new DashboardReportDto(
            newPatients,
            apptsCount,
            completedAppts,
            cancelledAppts,
            noShowAppts,
            completedTreatments,
            prescriptionsIssued,
            followUpsCompleted,
            revenue,
            paymentsReceived,
            outstanding,
            expenses,
            doctorCompensation,
            netProfit,
            range.Currency,
            range.TimeZone
        );
    }

    public async Task<FinancialReportDto> GetFinancialReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var revenue = await context.Revenues.AsNoTracking()
            .Where(r => r.OccurredAt >= range.FromUtc && r.OccurredAt < range.ToUtc)
            .SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

        var payments = await context.Payments.AsNoTracking()
            .Where(p => p.PaidAt >= range.FromUtc && p.PaidAt < range.ToUtc)
            .SumAsync(p => (decimal?)p.Amount, token) ?? 0m;

        var outstanding = Math.Max(0m, revenue - payments);

        var expenses = await context.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= range.FromUtc && e.ExpenseDate < range.ToUtc)
            .SumAsync(e => (decimal?)e.Amount, token) ?? 0m;

        var doctorCompensation = await context.DoctorCompensationCosts.AsNoTracking()
            .Where(c => c.OccurredAt >= range.FromUtc && c.OccurredAt < range.ToUtc)
            .SumAsync(c => (decimal?)c.Amount, token) ?? 0m;

        var netProfit = revenue - doctorCompensation - expenses;

        return new FinancialReportDto(revenue, payments, outstanding, expenses, doctorCompensation, netProfit, range.Currency);
    }

    public async Task<RevenueReportDto> GetRevenueReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var query = context.Revenues.AsNoTracking()
            .Where(r => r.OccurredAt >= range.FromUtc && r.OccurredAt < range.ToUtc);

        if (filter.DoctorId.HasValue)
        {
            query = query.Where(r => r.DoctorProfileId == filter.DoctorId.Value);
        }

        var totalRevenue = await query.SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

        var revenuesList = await query
            .Select(r => new { r.OccurredAt, r.Amount, r.DoctorProfileId, r.TreatmentId, r.CategoryId })
            .ToListAsync(token);

        var byPeriod = revenuesList
            .GroupBy(r => r.OccurredAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
            .Select(g => new RevenueByPeriodDto(g.Key, g.Sum(x => x.Amount)))
            .OrderBy(x => x.Period)
            .ToList();

        var doctorsMap = await (from doc in context.DoctorProfiles.AsNoTracking()
                                join user in context.ClinicUsers.AsNoTracking() on doc.ClinicUserId equals user.Id
                                select new { doc.Id, user.DisplayName })
                                .ToDictionaryAsync(d => d.Id, d => d.DisplayName, token);

        var byDoctor = revenuesList
            .Where(r => r.DoctorProfileId.HasValue)
            .GroupBy(r => r.DoctorProfileId!.Value)
            .Select(g => new RevenueByDoctorDto(
                g.Key,
                doctorsMap.TryGetValue(g.Key, out var name) ? name : "Unknown Doctor",
                g.Sum(x => x.Amount)
            ))
            .OrderByDescending(x => x.Revenue)
            .ToList();

        var treatmentIds = revenuesList.Where(r => r.TreatmentId.HasValue).Select(r => r.TreatmentId!.Value).Distinct().ToList();
        var treatmentTypesMap = await context.Treatments.AsNoTracking()
            .Where(t => treatmentIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.TreatmentName, token);

        var byTreatment = revenuesList
            .Where(r => r.TreatmentId.HasValue)
            .GroupBy(r => treatmentTypesMap.TryGetValue(r.TreatmentId!.Value, out var name) ? name : "General Treatment")
            .Select(g => new RevenueByTreatmentDto(g.Key, g.Sum(x => x.Amount), g.Count()))
            .OrderByDescending(x => x.Revenue)
            .ToList();

        var categoriesMap = await context.FinancialCategories.AsNoTracking()
            .ToDictionaryAsync(c => c.Id, c => c.Name, token);

        var byCategory = revenuesList
            .GroupBy(r => r.CategoryId)
            .Select(g => new RevenueByCategoryDto(
                g.Key,
                categoriesMap.TryGetValue(g.Key, out var name) ? name : "General Category",
                g.Sum(x => x.Amount)
            ))
            .OrderByDescending(x => x.Revenue)
            .ToList();

        return new RevenueReportDto(totalRevenue, byPeriod, byDoctor, byTreatment, byCategory, range.Currency);
    }

    public async Task<ExpenseReportDto> GetExpenseReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var query = context.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= range.FromUtc && e.ExpenseDate < range.ToUtc);

        if (filter.CategoryId.HasValue)
        {
            query = query.Where(e => e.CategoryId == filter.CategoryId.Value);
        }

        var totalExpenses = await query.SumAsync(e => (decimal?)e.Amount, token) ?? 0m;

        var expensesList = await query
            .Select(e => new { e.CategoryId, e.ExpenseDate, e.Amount })
            .ToListAsync(token);

        var categoriesMap = await context.FinancialCategories.AsNoTracking()
            .ToDictionaryAsync(c => c.Id, c => c.Name, token);

        var byCategory = expensesList
            .GroupBy(e => e.CategoryId)
            .Select(g => new ExpensesByCategoryDto(
                g.Key,
                categoriesMap.TryGetValue(g.Key, out var name) ? name : "General",
                g.Sum(x => x.Amount)
            ))
            .OrderByDescending(x => x.Amount)
            .ToList();

        var byMonth = expensesList
            .GroupBy(e => e.ExpenseDate.ToString("yyyy-MM", CultureInfo.InvariantCulture))
            .Select(g => new ExpensesByMonthDto(g.Key, g.Sum(x => x.Amount)))
            .OrderBy(x => x.Month)
            .ToList();

        var topCategories = byCategory.Take(5).ToList();

        return new ExpenseReportDto(totalExpenses, byCategory, byMonth, topCategories, range.Currency);
    }

    public async Task<ProfitReportDto> GetProfitReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        async Task<ProfitPeriodMetricsDto> GetMetricsForRange(DateTimeOffset start, DateTimeOffset end)
        {
            var rev = await context.Revenues.AsNoTracking()
                .Where(r => r.OccurredAt >= start && r.OccurredAt < end)
                .SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

            var comp = await context.DoctorCompensationCosts.AsNoTracking()
                .Where(c => c.OccurredAt >= start && c.OccurredAt < end)
                .SumAsync(c => (decimal?)c.Amount, token) ?? 0m;

            var exp = await context.Expenses.AsNoTracking()
                .Where(e => e.ExpenseDate >= start && e.ExpenseDate < end)
                .SumAsync(e => (decimal?)e.Amount, token) ?? 0m;

            var profit = rev - comp - exp;
            return new ProfitPeriodMetricsDto(rev, comp, exp, profit);
        }

        var currentMetrics = await GetMetricsForRange(range.FromUtc, range.ToUtc);
        var previousMetrics = await GetMetricsForRange(range.PrevFromUtc, range.PrevToUtc);

        decimal CalcGrowth(decimal current, decimal previous)
        {
            if (previous == 0m)
                return current > 0m ? 100m : 0m;
            return Math.Round(((current - previous) / Math.Abs(previous)) * 100m, 2);
        }

        var revGrowth = CalcGrowth(currentMetrics.Revenue, previousMetrics.Revenue);
        var expGrowth = CalcGrowth(currentMetrics.OperatingExpenses, previousMetrics.OperatingExpenses);
        var profitGrowth = CalcGrowth(currentMetrics.NetProfit, previousMetrics.NetProfit);

        return new ProfitReportDto(currentMetrics, previousMetrics, revGrowth, expGrowth, profitGrowth, range.Currency);
    }

    public async Task<PatientReportDto> GetPatientReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var patients = await context.Patients.AsNoTracking()
            .Select(p => new { p.CreatedAt, p.Status })
            .ToListAsync(token);

        var totalPatients = patients.Count;
        var archivedPatients = patients.Count(p => p.Status == PatientStatus.Archived);
        var activePatients = totalPatients - archivedPatients;

        var newPatientsInPeriod = patients.Count(p => p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtc);
        var returningPatientsInPeriod = Math.Max(0, activePatients - newPatientsInPeriod);

        var newPatientsByMonth = patients
            .Where(p => p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtc)
            .GroupBy(p => p.CreatedAt.ToString("yyyy-MM", CultureInfo.InvariantCulture))
            .Select(g => new NewPatientsByPeriodDto(g.Key, g.Count()))
            .OrderBy(x => x.Period)
            .ToList();

        var prevPeriodCount = patients.Count(p => p.CreatedAt >= range.PrevFromUtc && p.CreatedAt < range.PrevToUtc);
        decimal growthPercentage = prevPeriodCount == 0
            ? (newPatientsInPeriod > 0 ? 100m : 0m)
            : Math.Round(((decimal)(newPatientsInPeriod - prevPeriodCount) / prevPeriodCount) * 100m, 2);

        return new PatientReportDto(
            newPatientsInPeriod,
            returningPatientsInPeriod,
            activePatients,
            archivedPatients,
            totalPatients,
            newPatientsByMonth,
            growthPercentage
        );
    }

    public async Task<AppointmentReportDto> GetAppointmentReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var query = context.Appointments.AsNoTracking()
            .Where(a => a.StartAt >= range.FromUtc && a.StartAt < range.ToUtc);

        var targetDoctorId = doctorRestrictionId ?? filter.DoctorId;
        if (targetDoctorId.HasValue)
        {
            query = query.Where(a => a.DoctorProfileId == targetDoctorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status) && Enum.TryParse<AppointmentStatus>(filter.Status, true, out var statusEnum))
        {
            query = query.Where(a => a.Status == statusEnum);
        }

        var list = await query.Select(a => a.Status).ToListAsync(token);
        var total = list.Count;

        var scheduled = list.Count(s => s == AppointmentStatus.Scheduled);
        var confirmed = list.Count(s => s == AppointmentStatus.Confirmed);
        var checkedIn = list.Count(s => s == AppointmentStatus.CheckedIn);
        var inProgress = list.Count(s => s == AppointmentStatus.InProgress);
        var completed = list.Count(s => s == AppointmentStatus.Completed);
        var cancelled = list.Count(s => s == AppointmentStatus.Cancelled);
        var noShow = list.Count(s => s == AppointmentStatus.NoShow);

        decimal compRate = total == 0 ? 0m : Math.Round(((decimal)completed / total) * 100m, 2);
        decimal cancRate = total == 0 ? 0m : Math.Round(((decimal)cancelled / total) * 100m, 2);
        decimal nsRate = total == 0 ? 0m : Math.Round(((decimal)noShow / total) * 100m, 2);

        var byStatus = list
            .GroupBy(s => s.ToString())
            .Select(g => new AppointmentStatusCountDto(g.Key, g.Count()))
            .ToList();

        return new AppointmentReportDto(
            total, scheduled, confirmed, checkedIn, inProgress, completed, cancelled, noShow,
            compRate, cancRate, nsRate, byStatus
        );
    }

    public async Task<DoctorPerformanceReportDto> GetDoctorPerformanceReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var doctorsQuery = from doc in context.DoctorProfiles.AsNoTracking()
                           join user in context.ClinicUsers.AsNoTracking() on doc.ClinicUserId equals user.Id
                           select new { doc.Id, user.DisplayName };

        var targetDoctorId = doctorRestrictionId ?? filter.DoctorId;
        var doctors = targetDoctorId.HasValue
            ? await doctorsQuery.Where(d => d.Id == targetDoctorId.Value).ToListAsync(token)
            : await doctorsQuery.ToListAsync(token);

        var items = new List<DoctorPerformanceItemDto>();

        foreach (var doc in doctors)
        {
            var appts = await context.Appointments.AsNoTracking()
                .Where(a => a.DoctorProfileId == doc.Id && a.StartAt >= range.FromUtc && a.StartAt < range.ToUtc)
                .Select(a => a.Status)
                .ToListAsync(token);

            var totalAppts = appts.Count;
            var compAppts = appts.Count(s => s == AppointmentStatus.Completed);
            var cancAppts = appts.Count(s => s == AppointmentStatus.Cancelled);
            var nsAppts = appts.Count(s => s == AppointmentStatus.NoShow);

            var compTx = await context.Treatments.AsNoTracking()
                .CountAsync(t => t.DoctorProfileId == doc.Id && t.Status == TreatmentStatus.Completed && t.CompletedAt >= range.FromUtc && t.CompletedAt < range.ToUtc, token);

            var rev = await context.Revenues.AsNoTracking()
                .Where(r => r.DoctorProfileId == doc.Id && r.OccurredAt >= range.FromUtc && r.OccurredAt < range.ToUtc)
                .SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

            var compCost = await context.DoctorCompensationCosts.AsNoTracking()
                .Where(c => c.DoctorProfileId == doc.Id && c.OccurredAt >= range.FromUtc && c.OccurredAt < range.ToUtc)
                .SumAsync(c => (decimal?)c.Amount, token) ?? 0m;

            items.Add(new DoctorPerformanceItemDto(
                doc.Id,
                doc.DisplayName,
                totalAppts,
                compAppts,
                cancAppts,
                nsAppts,
                compTx,
                rev,
                compCost
            ));
        }

        return new DoctorPerformanceReportDto(items.OrderByDescending(x => x.Revenue).ToList(), range.Currency);
    }

    public async Task<TreatmentReportDto> GetTreatmentReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var query = context.Treatments.AsNoTracking()
            .Where(t => (t.CompletedAt >= range.FromUtc && t.CompletedAt < range.ToUtc) || (t.CreatedAt >= range.FromUtc && t.CreatedAt < range.ToUtc));

        var targetDoctorId = doctorRestrictionId ?? filter.DoctorId;
        if (targetDoctorId.HasValue)
        {
            query = query.Where(t => t.DoctorProfileId == targetDoctorId.Value);
        }

        var txList = await query
            .Select(t => new { t.Id, t.DoctorProfileId, t.Status, t.TreatmentName, t.CompletedAt, t.CreatedAt })
            .ToListAsync(token);

        var total = txList.Count;
        var completed = txList.Count(t => t.Status == TreatmentStatus.Completed);
        var cancelled = txList.Count(t => t.Status == TreatmentStatus.Cancelled);

        var revQuery = context.Revenues.AsNoTracking()
            .Where(r => r.OccurredAt >= range.FromUtc && r.OccurredAt < range.ToUtc);
        if (targetDoctorId.HasValue)
        {
            revQuery = revQuery.Where(r => r.DoctorProfileId == targetDoctorId.Value);
        }
        var totalRevenue = await revQuery.SumAsync(r => (decimal?)r.Amount, token) ?? 0m;

        var byType = txList
            .GroupBy(t => t.TreatmentName)
            .Select(g => new TreatmentsByTypeDto(g.Key, g.Count(), 0m))
            .OrderByDescending(x => x.Count)
            .ToList();

        var doctorsMap = await (from doc in context.DoctorProfiles.AsNoTracking()
                                join user in context.ClinicUsers.AsNoTracking() on doc.ClinicUserId equals user.Id
                                select new { doc.Id, user.DisplayName })
                                .ToDictionaryAsync(d => d.Id, d => d.DisplayName, token);

        var byDoctor = txList
            .GroupBy(t => t.DoctorProfileId)
            .Select(g => new TreatmentsByDoctorDto(
                g.Key,
                doctorsMap.TryGetValue(g.Key, out var name) ? name : "Unknown Doctor",
                g.Count(),
                0m
            ))
            .OrderByDescending(x => x.Count)
            .ToList();

        var byMonth = txList
            .GroupBy(t => (t.CompletedAt ?? t.CreatedAt).ToString("yyyy-MM", CultureInfo.InvariantCulture))
            .Select(g => new TreatmentsByMonthDto(g.Key, g.Count(), 0m))
            .OrderBy(x => x.Month)
            .ToList();

        return new TreatmentReportDto(total, completed, cancelled, totalRevenue, byType, byDoctor, byMonth, range.Currency);
    }

    public async Task<PrescriptionReportDto> GetPrescriptionReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var query = context.Prescriptions.AsNoTracking()
            .Where(p => (p.IssuedAt >= range.FromUtc && p.IssuedAt < range.ToUtc) || (p.CreatedAt >= range.FromUtc && p.CreatedAt < range.ToUtc));

        var targetDoctorId = doctorRestrictionId ?? filter.DoctorId;
        if (targetDoctorId.HasValue)
        {
            query = query.Where(p => p.DoctorProfileId == targetDoctorId.Value);
        }

        var rxList = await query
            .Select(p => new { p.Id, p.DoctorProfileId, p.Status, p.IssuedAt, p.CreatedAt })
            .ToListAsync(token);

        var issued = rxList.Count(p => p.Status == PrescriptionStatus.Issued);
        var cancelled = rxList.Count(p => p.Status == PrescriptionStatus.Cancelled);

        var byMonth = rxList
            .GroupBy(p => (p.IssuedAt ?? p.CreatedAt).ToString("yyyy-MM", CultureInfo.InvariantCulture))
            .Select(g => new PrescriptionsByMonthDto(g.Key, g.Count()))
            .OrderBy(x => x.Month)
            .ToList();

        var doctorsMap = await (from doc in context.DoctorProfiles.AsNoTracking()
                                join user in context.ClinicUsers.AsNoTracking() on doc.ClinicUserId equals user.Id
                                select new { doc.Id, user.DisplayName })
                                .ToDictionaryAsync(d => d.Id, d => d.DisplayName, token);

        var byDoctor = rxList
            .GroupBy(p => p.DoctorProfileId)
            .Select(g => new PrescriptionsByDoctorDto(
                g.Key,
                doctorsMap.TryGetValue(g.Key, out var name) ? name : "Unknown Doctor",
                g.Count()
            ))
            .OrderByDescending(x => x.Count)
            .ToList();

        return new PrescriptionReportDto(issued, cancelled, byMonth, byDoctor);
    }

    public async Task<CrmReportDto> GetCrmReportAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var range = await ResolveRangeAsync(filter, token);

        var followUps = await context.FollowUps.AsNoTracking()
            .Where(f => f.CreatedAt >= range.FromUtc && f.CreatedAt < range.ToUtc)
            .Select(f => new { f.Id, f.Status, f.Type, f.AssignedToUserId, f.DueAt })
            .ToListAsync(token);

        var created = followUps.Count;
        var completed = followUps.Count(f => f.Status == FollowUpStatus.Completed);
        var pending = followUps.Count(f => f.Status == FollowUpStatus.Pending || f.Status == FollowUpStatus.InProgress);
        var cancelled = followUps.Count(f => f.Status == FollowUpStatus.Cancelled);
        var overdue = followUps.Count(f => (f.Status == FollowUpStatus.Pending || f.Status == FollowUpStatus.InProgress) && f.DueAt < clock.UtcNow);

        var byType = followUps
            .GroupBy(f => f.Type.ToString())
            .Select(g => new FollowUpsByTypeDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var assigneeIds = followUps.Select(f => f.AssignedToUserId).Distinct().ToList();
        var usersMap = await context.ClinicUsers.AsNoTracking()
            .Where(u => assigneeIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, token);

        var byAssignee = followUps
            .GroupBy(f => (Guid?)f.AssignedToUserId)
            .Select(g => new FollowUpsByAssigneeDto(
                g.Key,
                g.Key.HasValue && usersMap.TryGetValue(g.Key.Value, out var name) ? name : "Unassigned",
                g.Count()
            ))
            .OrderByDescending(x => x.Count)
            .ToList();

        return new CrmReportDto(created, completed, pending, overdue, cancelled, byType, byAssignee);
    }
}
