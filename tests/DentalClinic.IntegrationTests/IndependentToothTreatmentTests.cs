using System.Text.Json.Nodes;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.IntegrationTests;

public sealed partial class RowLevelSecurityTests
{
    private static readonly string[] IndependentRootSteps = ["access", "length", "obturation"];
    [Fact]
    public async Task RepeatedFillingsOnOneToothHaveIndependentHistoryAndOnlyCompletedExecutionsAreBilled()
    {
        using var scope = database.Scope(database.AdminA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        var patient = new Patient(database.TenantA, "REPEAT-000001", "Repeat", null, "Test", PatientGender.NotSpecified,
            new DateOnly(1990, 1, 1), "01000000000", null, null, null, null, null, null, null, null, null, null, null, null, now);
        db.Patients.Add(patient);
        if (!await db.FinancialCategories.AnyAsync(c => c.Code == "TREATMENT_REVENUE"))
            db.FinancialCategories.Add(new(database.TenantA, "Treatment revenue", "TREATMENT_REVENUE", FinancialCategoryType.Revenue, null, now));
        var catalog = new TreatmentCatalogItem(database.TenantA, TreatmentType.Filling, "Repeat filling", "REPEAT-FILL", null, 350, now);
        db.TreatmentCatalogItems.Add(catalog); await db.SaveChangesAsync();
        var firstVisit = await RootVisitAsync(scope.ServiceProvider, db, 60, patient.Id);
        var service = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
        var finance = scope.ServiceProvider.GetRequiredService<IFinanceQueries>();
        var before = (await finance.PatientBalanceAsync(patient.Id, CancellationToken.None))!.TotalRevenue;
        async Task<Guid> Create(Guid visit, string notes, Guid? executionId = null) => await service.CreateAsync(new(patient.Id, database.DoctorA,
            catalog.Id, visit, null, null, [36], notes, NewExecutionId: executionId), CancellationToken.None);
        async Task Complete(Guid id, Guid visit)
        {
            var work = (await service.GetAsync(id, CancellationToken.None))!;
            await service.TransitionAsync(id, "complete", work.Version, CancellationToken.None, visit);
        }
        var firstExecution = Guid.NewGuid();
        var first = await Create(firstVisit.AppointmentId, "First independent execution", firstExecution);
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentId == first));
        Assert.Equal(before, (await finance.PatientBalanceAsync(patient.Id, CancellationToken.None))!.TotalRevenue);
        await Complete(first, firstVisit.AppointmentId);
        var original = (await service.GetAsync(first, CancellationToken.None))!;
        Assert.Equal(first, await Create(firstVisit.AppointmentId, "First independent execution", firstExecution));
        var second = await Create(firstVisit.AppointmentId, "Second execution in the same visit");
        await Complete(second, firstVisit.AppointmentId);
        var nextVisit = await RootVisitAsync(scope.ServiceProvider, db, 61, patient.Id);
        var third = await Create(firstVisit.AppointmentId, "Third execution in a later visit");
        var thirdWork = (await service.GetAsync(third, CancellationToken.None))!;
        await service.TransitionAsync(third, "start", thirdWork.Version, CancellationToken.None);
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentId == third));
        Assert.Equal(before + 700, (await finance.PatientBalanceAsync(patient.Id, CancellationToken.None))!.TotalRevenue);
        await Assert.ThrowsAsync<TreatmentStateException>(() => Complete(third, Guid.NewGuid()));
        await Complete(third, nextVisit.AppointmentId);
        Assert.Equal(nextVisit.AppointmentId, (await service.GetAsync(third, CancellationToken.None))!.AppointmentId);
        var creator = scope.ServiceProvider.GetRequiredService<ITreatmentRevenueCreator>();
        await creator.EnsureForCompletedTreatmentAsync(first, CancellationToken.None);
        await creator.EnsureForCompletedTreatmentAsync(third, CancellationToken.None);
        await db.SaveChangesAsync();
        Assert.NotEqual(first, second); Assert.NotEqual(second, third);
        Assert.Equal(3, await db.Revenues.CountAsync(r => r.TreatmentId == first || r.TreatmentId == second || r.TreatmentId == third));
        Assert.Equal(before + 1050, (await finance.PatientBalanceAsync(patient.Id, CancellationToken.None))!.TotalRevenue);
        var unchanged = (await service.GetAsync(first, CancellationToken.None))!;
        Assert.Equal(original.Version, unchanged.Version); Assert.Equal(original.Notes, unchanged.Notes);
        Assert.Equal(original.Price, unchanged.Price); Assert.Equal(original.CompletedAt, unchanged.CompletedAt);
        Assert.Equal(original.AppointmentId, unchanged.AppointmentId);

        var rootCatalog = new TreatmentCatalogItem(database.TenantA, TreatmentType.RootCanal, "Plan root canal", "PLAN-ROOT-REPEAT", null, 700, now);
        db.TreatmentCatalogItems.Add(rootCatalog); await db.SaveChangesAsync();
        var planned = await scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().CreateAsync(new(patient.Id,
            database.DoctorA, "Future repeated filling and root", null, 0, [new(catalog.Id, 36, 1, 0, null), new(rootCatalog.Id, 36, 1, 0, null)]), CancellationToken.None);
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentPlanId == planned));
        Assert.Equal(before + 1050, (await finance.PatientBalanceAsync(patient.Id, CancellationToken.None))!.TotalRevenue);
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentPlanId == planned));
        var plans = scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>();
        var plan = (await plans.GetAsync(planned, CancellationToken.None))!;
        await plans.TransitionAsync(planned, "propose", plan.Version, CancellationToken.None);
        plan = (await plans.GetAsync(planned, CancellationToken.None))!;
        await plans.TransitionAsync(planned, "accept", plan.Version, CancellationToken.None);
        var planItem = plan.Items.Single(i => i.CatalogItemId == catalog.Id).Id;
        for (var execution = 0; execution < 2; execution++)
        {
            var work = await service.CreateAsync(new(patient.Id, database.DoctorA, catalog.Id, nextVisit.AppointmentId,
                planItem, null, [36], "Independent planned execution " + execution), CancellationToken.None);
            await Complete(work, nextVisit.AppointmentId);
        }
        Assert.Equal(2, await db.Revenues.CountAsync(r => r.TreatmentPlanId == planned && r.TreatmentId != null));
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentPlanId == planned && r.TreatmentId == null));
        var rootId = await service.CreateAsync(new(patient.Id, database.DoctorA, rootCatalog.Id, nextVisit.AppointmentId,
            plan.Items.Single(i => i.CatalogItemId == rootCatalog.Id).Id, null, [36], "Root after completed plan fillings"), CancellationToken.None);
        var rootService = scope.ServiceProvider.GetRequiredService<RootTreatmentFlowService>();
        var state = RootTreatmentFlow.Parse("""{"version":1,"needsPost":false,"needsCrown":false,"progress":{},"crown":{"completed":[false,false,false,false,false]}}""");
        foreach (var step in IndependentRootSteps)
        {
            state["progress"]![step] = new JsonObject { ["completed"] = true };
            if (step == "obturation") state["obturationDone"] = true;
            var saved = await rootService.SaveAsync(nextVisit.Id, 36, new(nextVisit.Version, rootId, rootCatalog.Id, null,
                RootFlowCanals, state.ToJsonString(), null, null), CancellationToken.None);
            state = RootTreatmentFlow.Parse(saved.WorkflowJson);
            Assert.Equal("false", state["billingReviewRequired"]!.ToString());
        }
        Assert.Single(await db.Revenues.Where(r => db.Treatments.Any(t => t.ParentTreatmentId == rootId && t.Id == r.TreatmentId)).ToListAsync());
        var deferred = await service.CreateAsync(new(patient.Id, database.DoctorA, catalog.Id, nextVisit.AppointmentId,
            null, null, [36], "Unperformed deferred price", DeferBilling: true), CancellationToken.None);
        var dental = scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Dental.IDentalStore>();
        Assert.False(await dental.HasUnapprovedVisitPricesAsync(nextVisit.AppointmentId, CancellationToken.None));
        await Complete(deferred, nextVisit.AppointmentId);
        Assert.True(await dental.HasUnapprovedVisitPricesAsync(nextVisit.AppointmentId, CancellationToken.None));
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentId == deferred));
        var approval = (await service.GetAsync(deferred, CancellationToken.None))!;
        await service.ConfirmPriceAsync(deferred, 350, approval.Version, CancellationToken.None);
        Assert.False(await dental.HasUnapprovedVisitPricesAsync(nextVisit.AppointmentId, CancellationToken.None));
        Assert.Single(await db.Revenues.Where(r => r.TreatmentId == deferred).ToListAsync());
    }

    [Fact]
    public async Task NewRootExecutionsOnTheSameToothDoNotResumeOrReplaceTheFirstCase()
    {
        using var scope = database.Scope(database.AdminA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var catalog = new TreatmentCatalogItem(database.TenantA, TreatmentType.RootCanal, "Independent root canal", "INDEPENDENT-ROOT", null, 700, DateTimeOffset.UtcNow);
        db.TreatmentCatalogItems.Add(catalog); await db.SaveChangesAsync();
        var visit = await RootVisitAsync(scope.ServiceProvider, db, 62);
        var service = scope.ServiceProvider.GetRequiredService<RootTreatmentFlowService>();
        const string initial = """{"version":1,"needsPost":false,"needsCrown":false,"progress":{"access":{"completed":true}},"crown":{"completed":[false,false,false,false,false]}}""";
        var firstId = Guid.NewGuid(); var secondId = Guid.NewGuid();
        var first = await service.SaveAsync(visit.Id, 26, new(visit.Version, null, catalog.Id, "First case", RootFlowCanals, initial, null, null, NewExecutionId: firstId), CancellationToken.None);
        var second = await service.SaveAsync(visit.Id, 26, new(visit.Version, null, catalog.Id, "Second case", RootFlowCanals, initial, null, null, NewExecutionId: secondId), CancellationToken.None);
        Assert.Equal(firstId, first.TreatmentId); Assert.Equal(secondId, second.TreatmentId);
        Assert.Equal(2, await db.EndodonticRecords.CountAsync(r => r.ExaminationId == visit.Id && r.ToothNumber == 26));
        Assert.Equal(first.WorkflowJson, (await db.Treatments.SingleAsync(t => t.Id == firstId)).ClinicalWorkflowJson);
        var resumed = await service.SaveAsync(visit.Id, 26, new(visit.Version, firstId, catalog.Id, "Resume first case", RootFlowCanals, first.WorkflowJson, null, null), CancellationToken.None);
        Assert.Equal(firstId, resumed.TreatmentId);
        Assert.Equal(2, await db.Treatments.CountAsync(t => t.TreatmentCatalogItemId == catalog.Id && t.ParentTreatmentId == null));
    }
}
