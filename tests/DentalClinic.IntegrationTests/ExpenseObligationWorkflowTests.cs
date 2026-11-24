
using DentalClinic.Application.Finance;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.ClinicBusiness;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task ExpenseLedgerSeparatesFixedAndLabLiabilitiesFromActualPayments()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "expenses-ledger", "admin@expenses-ledger.example");
        await AcceptAsync(test, "admin@expenses-ledger.example");
        SetActor(test, clinic);
        var setup = await CreateStartedAppointmentAsync(test, clinic, "Lab", "Patient", "EXP-LAB1");
        await using var scope = test.Provider.CreateAsyncScope();
        var obligations = scope.ServiceProvider.GetRequiredService<ExpenseObligationsService>();
        var expenseService = scope.ServiceProvider.GetRequiredService<IExpenseService>();
        var categories = scope.ServiceProvider.GetRequiredService<IFinancialCategoryService>();
        var rent = (await categories.ListAsync(false, FinancialCategoryType.Expense, CancellationToken.None))
            .First(x => x.Code == "RENT");
        var schedule = await obligations.AddScheduleAsync(new("Clinic rent", rent.Id, "Landlord", 12000, 1, new(2026, 7, 1)), CancellationToken.None);
        await obligations.AddScheduleAsync(new("Monthly internet", rent.Id, "Provider", 850, 31, new(2026, 6, 1)), CancellationToken.None);
        Assert.Equal(0, await obligations.GenerateMonthlyAsync(clinic.TenantId, CancellationToken.None));

        var ledger = await obligations.LedgerAsync(1, 1, CancellationToken.None);
        Assert.Empty(ledger.Paid.Items);
        Assert.Equal(new[] { new DateOnly(2026, 8, 1), new DateOnly(2026, 7, 1) },
            ledger.Due.Items.Where(x => x.Description == "Clinic rent").Select(x => x.DueDate));
        Assert.Equal(new[] { new DateOnly(2026, 7, 31), new DateOnly(2026, 6, 30) },
            ledger.Due.Items.Where(x => x.Description == "Monthly internet").Select(x => x.DueDate));
        var fixedDue = ledger.Due.Items.Single(x => x.DueDate == new DateOnly(2026, 8, 1));
        Assert.True(fixedDue.IsFixed);
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        Assert.False(await db.FinancialTransactions.AnyAsync(x => x.Type == FinancialTransactionType.Expense));
        Assert.Equal(schedule, await db.FixedExpensesDue.Where(x => x.Id == fixedDue.Id).Select(x => x.ScheduleId).SingleAsync());

        var payment = new ExpenseInput(rent.Id, 1, null, "Ignored", null, null, Monday, new(10, 0), null, fixedDue.Id);
        var paymentId = await expenseService.CreateAsync(payment, CancellationToken.None);
        await Assert.ThrowsAsync<FinanceConflictException>(() => expenseService.CreateAsync(payment, CancellationToken.None));
        ledger = await obligations.LedgerAsync(1, 1, CancellationToken.None);
        var paid = Assert.Single(ledger.Paid.Items);
        Assert.Equal(paymentId, paid.Id);
        Assert.True(paid.IsFixed);
        Assert.Equal("Landlord", paid.VendorName);
        Assert.Equal(12000, paid.Amount);
        Assert.DoesNotContain(ledger.Due.Items, x => x.Id == fixedDue.Id);

        var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
        var catalog = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>()
            .CreateAsync(new(TreatmentType.Crown, "Crown", "LAB-CROWN", null, 1000), CancellationToken.None);
        var treatment = await treatments.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalog, setup.Id, null, null, [36], null), CancellationToken.None);
        var lab = scope.ServiceProvider.GetRequiredService<ClinicBusinessService>();
        var vendor = await lab.AddVendorAsync("Planora lab", null, null, CancellationToken.None);
        var labCase = await lab.AddCaseAsync(new(vendor, setup.PatientId, treatment, "Crown", "36", null, null,
            null, DateTimeOffset.UtcNow.AddDays(3), 350), CancellationToken.None);
        Assert.DoesNotContain((await obligations.LedgerAsync(1, 1, CancellationToken.None)).Due.Items, x => x.Id == labCase);
        var item = (await treatments.GetAsync(treatment, CancellationToken.None))!;
        await treatments.TransitionAsync(treatment, "start", item.Version, CancellationToken.None);
        item = (await treatments.GetAsync(treatment, CancellationToken.None))!;
        await treatments.TransitionAsync(treatment, "complete", item.Version, CancellationToken.None);
        var due = Assert.Single((await obligations.LedgerAsync(1, 1, CancellationToken.None)).Due.Items, x => !x.IsFixed);
        Assert.Equal(labCase, due.Id);
        Assert.Equal(350, due.Amount);
        Assert.Equal("Planora lab", due.VendorName);
        Assert.Equal(setup.PatientId, due.LabPatientId);

        await lab.ChangeCaseAsync(labCase, new(LabCaseStatus.Ready, null), CancellationToken.None);
        var statement = await lab.AddStatementAsync(new(vendor, null, [labCase]), CancellationToken.None);
        await lab.SettleStatementAsync(statement, new(null, null, [new(labCase, 100)]), CancellationToken.None);
        due = Assert.Single((await obligations.LedgerAsync(1, 1, CancellationToken.None)).Due.Items, x => !x.IsFixed);
        Assert.Equal(250, due.Amount);
        Assert.Equal(statement, due.LabStatementId);
        await lab.SettleStatementAsync(statement, new(null, null, [new(labCase, 250)]), CancellationToken.None);
        ledger = await obligations.LedgerAsync(1, 1, CancellationToken.None);
        Assert.DoesNotContain(ledger.Due.Items, x => !x.IsFixed);
        Assert.Equal(350, ledger.Paid.Items.Where(x => !x.IsFixed).Sum(x => x.Amount));
        Assert.Equal(3, await db.FinancialTransactions.CountAsync(x => x.Type == FinancialTransactionType.Expense));
    }
}
