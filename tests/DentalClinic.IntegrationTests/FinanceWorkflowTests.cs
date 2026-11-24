using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task RevenueSummaryUsesAllMatchingRowsAndGroupsByCatalogService()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "finance-results", "admin@finance-results.example");
        await AcceptAsync(test, "admin@finance-results.example");
        SetActor(test, clinic);
        var setup = await CreateStartedAppointmentAsync(test, clinic, "Revenue", "Patient", "FIN-RSLT");
        await using var scope = test.Provider.CreateAsyncScope();
        var catalog = scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>();
        var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
        var finance = scope.ServiceProvider.GetRequiredService<IFinanceQueries>();
        var filling = await catalog.CreateAsync(new(TreatmentType.Filling, "Composite", "FIN-COMP", null, 300), CancellationToken.None);
        var extraction = await catalog.CreateAsync(new(TreatmentType.Extraction, "Tooth extraction", "FIN-EXT", null, 1000), CancellationToken.None);

        async Task<Guid> CompleteAsync(Guid service, int tooth, string notes)
        {
            var id = await treatments.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, service, setup.Id, null, null, [tooth], notes), CancellationToken.None);
            var item = (await treatments.GetAsync(id, CancellationToken.None))!;
            await treatments.TransitionAsync(id, "start", item.Version, CancellationToken.None);
            item = (await treatments.GetAsync(id, CancellationToken.None))!;
            await treatments.TransitionAsync(id, "complete", item.Version, CancellationToken.None);
            return id;
        }

        await CompleteAsync(filling, 34, "Included");
        await CompleteAsync(filling, 35, "Included");
        var extractionId = await CompleteAsync(extraction, 36, "Included");
        await CompleteAsync(filling, 37, "Excluded");
        var extractionRevenue = Assert.Single((await finance.RevenuesAsync(new(TreatmentId: extractionId), CancellationToken.None)).Items);
        await scope.ServiceProvider.GetRequiredService<IPaymentService>().CreateAsync(
            new(setup.PatientId, extractionRevenue.Id, extractionId, 600, PaymentMethod.Cash, null, "Collected", Monday, new(10, 0)), CancellationToken.None);

        var search = new RevenueSearch(Search: "Included", From: Monday, To: Monday, PageSize: 1, IncludeSummary: true);
        var page = await finance.RevenuesAsync(search, CancellationToken.None);
        var row = Assert.Single(page.Items);
        Assert.Equal(setup.PatientId, row.PatientId);
        Assert.Equal("Revenue Patient", row.PatientName);
        Assert.False(string.IsNullOrEmpty(row.PatientNumber));
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        Assert.Equal(await db.Patients.Where(p => p.Id == setup.PatientId).Select(p => p.PatientNumber).SingleAsync(), row.PatientNumber);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal(3, page.TotalPages);
        var summary = Assert.IsType<RevenueResultsSummary>(page.Summary);
        Assert.Equal(new RevenueCurrencyTotals(row.Currency, 1600, 600, 1000), Assert.Single(summary.Totals));
        Assert.Collection(summary.Services,
            item => Assert.Equal(new RevenueServiceTotal(extraction, "Tooth extraction", TreatmentType.Extraction, row.Currency, 1000), item),
            item => Assert.Equal(new RevenueServiceTotal(filling, "Composite", TreatmentType.Filling, row.Currency, 600), item));

        var secondPage = await finance.RevenuesAsync(search with { Page = 2 }, CancellationToken.None);
        Assert.NotEqual(row.Id, Assert.Single(secondPage.Items).Id);
        Assert.Equal(summary.Totals, secondPage.Summary!.Totals);
        Assert.Equal(summary.Services, secondPage.Summary.Services);

        var matchedPayment = await finance.RevenuesAsync(search with { Search = "Collected" }, CancellationToken.None);
        Assert.Equal(400, Assert.Single(matchedPayment.Items).Outstanding);
        Assert.Equal(600, Assert.Single(matchedPayment.Summary!.Totals).Paid);

        var empty = await finance.RevenuesAsync(search with { From = Monday.AddDays(1), To = Monday.AddDays(1) }, CancellationToken.None);
        Assert.Empty(empty.Items);
        Assert.Empty(empty.Summary!.Services);
        Assert.Equal(new RevenueCurrencyTotals(row.Currency, 0, 0, 0), Assert.Single(empty.Summary.Totals));
    }

    [Fact]
    public async Task CompletedTreatmentCreatesOneRevenueDoctorCostPaymentExpenseAndBalance()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "finance-flow", "admin@finance-flow.example");
        await AcceptAsync(test, "admin@finance-flow.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "Finance", "Patient", "FIN-1");
        Guid treatmentId; Guid revenueId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<IDoctorCompensationService>().CreateAsync(new(setup.DoctorProfileId, new(CompensationType.FixedSalaryAndPercentage, 10000, 20, Monday, null)), CancellationToken.None);
            var catalog = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Filling, "Finance filling", "FIN-FILL", null, 1000), CancellationToken.None);
            var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>(); treatmentId = await treatments.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalog, setup.Id, null, null, [36], null), CancellationToken.None);
            var item = (await treatments.GetAsync(treatmentId, CancellationToken.None))!; await treatments.TransitionAsync(treatmentId, "start", item.Version, CancellationToken.None);
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<IFinanceQueries>().BillingQueueAsync(CancellationToken.None));
            item = (await treatments.GetAsync(treatmentId, CancellationToken.None))!; await treatments.TransitionAsync(treatmentId, "complete", item.Version, CancellationToken.None);
            var finance = scope.ServiceProvider.GetRequiredService<IFinanceQueries>(); var revenues = await finance.RevenuesAsync(new(TreatmentId: treatmentId), CancellationToken.None);
            var revenue = Assert.Single(revenues.Items); revenueId = revenue.Id; Assert.Equal(1000, revenue.Amount); Assert.Equal(1000, revenue.Outstanding);
            var queued = Assert.Single(await finance.BillingQueueAsync(CancellationToken.None));
            Assert.Equal(revenueId, queued.RevenueId); Assert.Equal(1000, queued.Outstanding);
            await scope.ServiceProvider.GetRequiredService<ITreatmentRevenueCreator>().EnsureForCompletedTreatmentAsync(treatmentId, CancellationToken.None);
            Assert.Single((await finance.RevenuesAsync(new(TreatmentId: treatmentId), CancellationToken.None)).Items);
            await scope.ServiceProvider.GetRequiredService<IPaymentService>().CreateAsync(new(setup.PatientId, revenueId, treatmentId, 400, PaymentMethod.Cash, "RCPT-1", null, Monday, new(10, 0)), CancellationToken.None);
            Assert.Equal(600, Assert.Single(await finance.BillingQueueAsync(CancellationToken.None)).Outstanding);
            var expenseCategory = (await scope.ServiceProvider.GetRequiredService<IFinancialCategoryService>().ListAsync(false, FinancialCategoryType.Expense, CancellationToken.None)).Single(x => x.Code == "MATERIALS");
            // 00:30 clinic time is 21:30 UTC on the previous day and must still count in Monday's clinic-local dashboard.
            await scope.ServiceProvider.GetRequiredService<IExpenseService>().CreateAsync(new(expenseCategory.Id, 100, null, "Dental material", "Supplier", "INV-1", Monday, new(0, 30), null), CancellationToken.None);
            var balance = (await finance.PatientBalanceAsync(setup.PatientId, CancellationToken.None))!; Assert.Equal(1000, balance.TotalRevenue); Assert.Equal(400, balance.TotalPaid); Assert.Equal(600, balance.Outstanding);
            var dashboard = await finance.DashboardAsync(new(FinancePeriod.Today), CancellationToken.None); Assert.Equal(1000, dashboard.Revenue); Assert.Equal(400, dashboard.Payments); Assert.Equal(100, dashboard.Expenses); Assert.Equal(200, dashboard.DoctorCompensation); Assert.Equal(700, dashboard.NetProfit);
            Assert.Equal(new FinanceRevenueComparison(0, Monday.AddDays(-1), Monday.AddDays(-1)), dashboard.RevenueComparison);
            var nextDay = Monday.AddDays(1);
            var nextDayDashboard = await finance.DashboardAsync(new(FinancePeriod.Custom, nextDay, nextDay), CancellationToken.None);
            Assert.Equal(0, nextDayDashboard.Revenue);
            Assert.Equal(new FinanceRevenueComparison(1000, Monday, Monday), nextDayDashboard.RevenueComparison);
            var lastMonth = await finance.DashboardAsync(new(FinancePeriod.LastMonth), CancellationToken.None);
            var firstOfMonth = new DateOnly(Monday.Year, Monday.Month, 1);
            Assert.Equal(new FinanceRevenueComparison(0, firstOfMonth.AddMonths(-2), firstOfMonth.AddMonths(-1).AddDays(-1)), lastMonth.RevenueComparison);
        }
        test.User.UserId = setup.DoctorUserId;
        await using (var ownScope = test.Provider.CreateAsyncScope())
        {
            var own = await ownScope.ServiceProvider.GetRequiredService<IFinanceQueries>().MyDuesAsync(CancellationToken.None);
            Assert.NotNull(own); Assert.Equal(200, own.Total);
        }
        test.User.UserId = clinic.AdminUserId;
        await using (var adminScope = test.Provider.CreateAsyncScope())
            Assert.Null(await adminScope.ServiceProvider.GetRequiredService<IFinanceQueries>().MyDuesAsync(CancellationToken.None));
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        Assert.Single(await db.DoctorCompensationCosts.Where(x => x.TreatmentId == treatmentId).ToListAsync());
        await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE revenues SET \"Amount\"=999 WHERE \"Id\"={revenueId}"));
    }

    [Fact]
    public async Task ConcurrentPaymentsCannotOverpayRevenue()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "finance-race", "admin@finance-race.example"); await AcceptAsync(test, "admin@finance-race.example"); SetActor(test, clinic);
        var setup = await CreateStartedAppointmentAsync(test, clinic, "Race", "Patient", "FIN-2"); Guid treatmentId; Guid revenueId;
        await using (var scope = test.Provider.CreateAsyncScope())
        { var catalog = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Filling, "Race filling", "FIN-RACE", null, 1000), CancellationToken.None); var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>(); treatmentId = await treatments.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalog, setup.Id, null, null, [35], null), CancellationToken.None); var item = (await treatments.GetAsync(treatmentId, CancellationToken.None))!; await treatments.TransitionAsync(treatmentId, "start", item.Version, CancellationToken.None); item = (await treatments.GetAsync(treatmentId, CancellationToken.None))!; await treatments.TransitionAsync(treatmentId, "complete", item.Version, CancellationToken.None); revenueId = (await scope.ServiceProvider.GetRequiredService<IFinanceQueries>().RevenuesAsync(new(TreatmentId: treatmentId), CancellationToken.None)).Items.Single().Id; }
        async Task<bool> Pay()
        { try { await using var scope = test.Provider.CreateAsyncScope(); await scope.ServiceProvider.GetRequiredService<IPaymentService>().CreateAsync(new(setup.PatientId, revenueId, treatmentId, 700, PaymentMethod.Cash, null, null, Monday, new(12, 0)), CancellationToken.None); return true; } catch (FinanceConflictException) { return false; } }
        Assert.Equal(1, (await Task.WhenAll(Pay(), Pay())).Count(x => x));
        await using var verify = test.Provider.CreateAsyncScope(); var revenue = (await verify.ServiceProvider.GetRequiredService<IFinanceQueries>().RevenueAsync(revenueId, CancellationToken.None))!; Assert.Equal(700, revenue.Paid); Assert.Equal(300, revenue.Outstanding);
    }

    [Fact]
    public async Task FinanceTenantReferencesAndPermissionsAreIsolated()
    {
        await using var test = await CreateContextAsync(); var alpha = await CreateClinicAsync(test, "finance-alpha", "admin@finance-alpha.example"); var beta = await CreateClinicAsync(test, "finance-beta", "admin@finance-beta.example"); await AcceptAsync(test, "admin@finance-alpha.example"); await AcceptAsync(test, "admin@finance-beta.example"); SetActor(test, alpha);
        var setup = await CreateStartedAppointmentAsync(test, alpha, "Alpha", "Finance", "FIN-3"); Guid revenueId;
        await using (var scope = test.Provider.CreateAsyncScope()) { var catalog = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Other, "Alpha treatment", "FIN-ALPHA", null, 500), CancellationToken.None); var service = scope.ServiceProvider.GetRequiredService<ITreatmentService>(); var id = await service.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalog, setup.Id, null, null, [], null), CancellationToken.None); var x = (await service.GetAsync(id, CancellationToken.None))!; await service.TransitionAsync(id, "start", x.Version, CancellationToken.None); x = (await service.GetAsync(id, CancellationToken.None))!; await service.TransitionAsync(id, "complete", x.Version, CancellationToken.None); revenueId = (await scope.ServiceProvider.GetRequiredService<IFinanceQueries>().RevenuesAsync(new(TreatmentId: id), CancellationToken.None)).Items.Single().Id; }
        SetActor(test, beta); await using (var scope = test.Provider.CreateAsyncScope()) { var finance = scope.ServiceProvider.GetRequiredService<IFinanceQueries>(); Assert.Null(await finance.RevenueAsync(revenueId, CancellationToken.None)); await Assert.ThrowsAsync<FinanceNotFoundException>(() => scope.ServiceProvider.GetRequiredService<IPaymentService>().CreateAsync(new(null, revenueId, null, 10, PaymentMethod.Cash, null, null, Monday, new(12, 0)), CancellationToken.None)); }
        SetActor(test, alpha); var receptionist = await InviteRoleAsync(test, "Reception", "reception@finance-alpha.example", SystemRoleDefinitions.Receptionist); await AcceptAsync(test, "reception@finance-alpha.example"); test.Tenant.Set(alpha.TenantId); test.User.UserId = receptionist;
        await using (var scope = test.Provider.CreateAsyncScope()) { await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<IFinanceQueries>().DashboardAsync(new(), CancellationToken.None)); Assert.NotNull(await scope.ServiceProvider.GetRequiredService<IFinanceQueries>().RevenueAsync(revenueId, CancellationToken.None)); }
        test.User.UserId = setup.DoctorUserId; await using var doctor = test.Provider.CreateAsyncScope(); await Assert.ThrowsAsync<ForbiddenAccessException>(() => doctor.ServiceProvider.GetRequiredService<IFinanceQueries>().RevenueAsync(revenueId, CancellationToken.None));
    }
}
