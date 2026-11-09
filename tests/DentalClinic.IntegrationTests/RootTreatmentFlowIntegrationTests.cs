using System.Text.Json.Nodes;
using DentalClinic.Application.Appointments;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.IntegrationTests;

public sealed partial class RowLevelSecurityTests
{
    private static readonly EndodonticCanalInput[] RootFlowCanals = [new("MB", 21, null, "30")];
    [Fact]
    public async Task RootFlowSurvivesThreeVisitsAndBillsOnlyFiveDistinctCompletedProcedures()
    {
        using var scope = database.Scope(database.AdminA); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        if (!await db.FinancialCategories.AnyAsync(c => c.Code == "TREATMENT_REVENUE"))
            db.FinancialCategories.Add(new(database.TenantA, "Treatment revenue", "TREATMENT_REVENUE", DentalClinic.Domain.Finance.FinancialCategoryType.Revenue, null, now));
        TreatmentCatalogItem Catalog(TreatmentType type, string name, string code, decimal price)
        { var item = new TreatmentCatalogItem(database.TenantA, type, name, code, null, price, now); db.TreatmentCatalogItems.Add(item); return item; }
        var root = Catalog(TreatmentType.RootCanal, "Root canal", "FLOW-ROOT", 1000);
        var temporary = Catalog(TreatmentType.Filling, "Temporary filling", "FLOW-TEMP", 100);
        var permanent = Catalog(TreatmentType.Filling, "Permanent core", "FLOW-CORE", 200);
        var post = Catalog(TreatmentType.Other, "Fiber post", "FLOW-POST", 300);
        var crown = Catalog(TreatmentType.Crown, "Crown", "FLOW-CROWN", 800);
        await db.SaveChangesAsync();
        var visit = await RootVisitAsync(scope.ServiceProvider, db, 40);
        var service = scope.ServiceProvider.GetRequiredService<RootTreatmentFlowService>();
        var state = RootTreatmentFlow.Parse("""{"version":1,"needsPost":false,"needsCrown":false,"crown":{"type":"Crown","material":"Zirconia","shade":"A2","laboratory":"Lab","completed":[false,false,false,false,false]}}""");
        state["billingCatalogIds"] = new JsonObject { ["temporary"] = temporary.Id.ToString(), ["permanent"] = permanent.Id.ToString(), ["post"] = post.Id.ToString(), ["crown"] = crown.Id.ToString() };
        Guid? parentId = null;
        async Task Save()
        {
            var saved = await service.SaveAsync(visit.Id, 26, new(visit.Version, parentId, root.Id, "Clinical progress", RootFlowCanals,
                state.ToJsonString(), state["postType"]?.ToString(), state["postCanal"]?.ToString()), CancellationToken.None);
            parentId = saved.TreatmentId; state = RootTreatmentFlow.Parse(saved.WorkflowJson);
        }
        async Task Step(string key)
        { state["progress"] ??= new JsonObject(); state["progress"]![key] = new JsonObject { ["completed"] = true }; await Save(); }
        await Step("access"); var access = state["progress"]!["access"]!.ToJsonString();
        await Assert.ThrowsAsync<DentalStateException>(() => scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Dental.IExaminationCommands>()
            .UpdateEndodonticAsync(visit.Id, visit.EndodonticRecords.Single().Id,
                new(26, "Cannot bypass the flow", RootFlowCanals, RootCanalStage.Completed, parentId, "composite", WorkflowJson: state.ToJsonString()), visit.Version, CancellationToken.None));
        await Step("length"); Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentId == parentId));
        state["obturationDone"] = true; await Step("obturation");
        state["finalMaterial"] = "temporary"; state["temporaryRequested"] = true; await Save(); await Save();
        Assert.Equal(5, RootTreatmentFlow.NextStage(state));
        Assert.Equal(2, await db.Treatments.CountAsync(t => t.ParentTreatmentId == parentId && t.Status == TreatmentStatus.Completed));
        visit.Complete(visit.Version, now); await db.SaveChangesAsync();
        visit = await RootVisitAsync(scope.ServiceProvider, db, 41); await Save();
        Assert.Equal(access, state["progress"]!["access"]!.ToJsonString());
        state["finalMaterial"] = "composite"; await Step("core");
        state["decisionsMade"] = true; state["needsPost"] = true; state["needsCrown"] = true; await Save();
        Assert.Equal(2, await db.Treatments.CountAsync(t => t.ParentTreatmentId == parentId && t.Status == TreatmentStatus.Planned));
        var balance = await scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Finance.IFinanceStore>().PatientBalanceAsync(database.PatientA, CancellationToken.None);
        Assert.Equal(1300, balance!.TotalRevenue);
        state["postType"] = "fiber"; state["postCanal"] = "MB"; state["postSize"] = "2"; state["postDone"] = true; await Step("post");
        visit.Complete(visit.Version, now); await db.SaveChangesAsync();
        visit = await RootVisitAsync(scope.ServiceProvider, db, 42); await Save();
        foreach (var index in new[] { 0, 1, 3 }) { state["crown"]!["completed"]![index] = true; await Save(); }
        Assert.Equal(4, await db.Revenues.CountAsync(r => db.Treatments.Any(t => t.Id == r.TreatmentId && t.ParentTreatmentId == parentId)));
        state["crown"]!["completed"]![4] = true; await Save();
        var components = await db.Treatments.Where(t => t.ParentTreatmentId == parentId).ToListAsync();
        Assert.Equal(5, components.Count); Assert.All(components, c => Assert.Equal(TreatmentStatus.Completed, c.Status));
        Assert.Equal(5, components.Select(c => c.SourceDentalProcedureId).Where(id => id.HasValue).Distinct().Count());
        var charges = await db.Revenues.Where(r => db.Treatments.Any(t => t.Id == r.TreatmentId && t.ParentTreatmentId == parentId)).ToListAsync();
        Assert.Equal(5, charges.Count); Assert.Equal(2400, charges.Sum(r => r.Amount));
        Assert.False(await db.Revenues.AnyAsync(r => r.TreatmentId == parentId));
        Assert.Equal(TreatmentStatus.Completed, (await db.Treatments.SingleAsync(t => t.Id == parentId)).Status);
        Assert.Equal(3, await db.EndodonticRecords.CountAsync(r => r.TreatmentId == parentId));
        await Assert.ThrowsAsync<DentalStateException>(Save);
        using var other = database.Scope(database.MemberB);
        var foreignDb = other.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Empty(await foreignDb.Treatments.IgnoreQueryFilters().Where(t => t.ParentTreatmentId == parentId).ToListAsync());
    }
    [Fact]
    public async Task ConcurrentFirstSavesCreateOnlyOneRootFlowAndNoPrematureRevenue()
    {
        Guid examinationId, catalogId, version;
        using (var scope = database.Scope(database.AdminA))
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var catalog = new TreatmentCatalogItem(database.TenantA, TreatmentType.RootCanal, "Root concurrency", "ROOT-CONCURRENT", """{"priceTiers":[{"id":"complex","price":940}]}""", 600, DateTimeOffset.UtcNow);
            db.TreatmentCatalogItems.Add(catalog); await db.SaveChangesAsync(); catalogId = catalog.Id;
            var visit = await RootVisitAsync(scope.ServiceProvider, db, 44); examinationId = visit.Id; version = visit.Version;
        }
        var request = new SaveRootTreatmentFlowRequest(version, null, catalogId, null, RootFlowCanals,
            """{"version":1,"needsPost":false,"needsCrown":false,"progress":{"access":{"completed":true}},"crown":{"completed":[false,false,false,false,false]}}""", null, null, "complex");
        async Task<bool> Write()
        {
            using var scope = database.Scope(database.AdminA);
            try { await scope.ServiceProvider.GetRequiredService<RootTreatmentFlowService>().SaveAsync(examinationId, 27, request, CancellationToken.None); return true; }
            catch (DentalConcurrencyException) { return false; }
        }
        var results = await Task.WhenAll(Write(), Write()); Assert.Single(results, x => x);
        using var check = database.Scope(database.AdminA); var context = check.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var parents = await context.Treatments.Where(t => t.TreatmentCatalogItemId == catalogId && t.ParentTreatmentId == null).ToListAsync();
        Assert.Single(parents); Assert.Equal(940, parents[0].Price); Assert.False(await context.Revenues.AnyAsync(r => r.TreatmentId == parents[0].Id));
    }
    private async Task<Examination> RootVisitAsync(IServiceProvider provider, ApplicationDbContext db, int days, Guid? patientId = null)
    {
        var now = DateTimeOffset.UtcNow;
        var id = await provider.GetRequiredService<ICreateAppointment>().ExecuteAsync(new(patientId ?? database.PatientA, database.DoctorA,
            AppointmentType.FollowUp, new(DateOnly.FromDateTime(now.AddDays(days).DateTime), new TimeOnly(12, 0), 30), "Root flow test"), CancellationToken.None);
        var appointment = await db.Appointments.SingleAsync(a => a.Id == id); appointment.CheckIn(now); appointment.Start(now);
        var examination = new Examination(database.TenantA, patientId ?? database.PatientA, id, database.MemberA, database.AdminA, now);
        db.Examinations.Add(examination); await db.SaveChangesAsync(); return examination;
    }
}
