using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.IntegrationTests;

public sealed partial class RowLevelSecurityTests
{
    [Fact]
    public async Task MedicalTimelinePreservesFirstExaminationAndActualStepsAcrossVisitsWithoutUsingNextStages()
    {
        using var scope = database.Scope(database.AdminA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); var now = DateTimeOffset.UtcNow;
        var patient = new Patient(database.TenantA, "TIME-000001", "Timeline", null, "Patient", PatientGender.NotSpecified,
            new DateOnly(1990, 1, 1), "01000000000", null, null, null, null, null, null, null, null, null, null, null, null, now);
        var filling = new TreatmentCatalogItem(database.TenantA, TreatmentType.Filling, "Composite Filling", "TIME-FILL", null, 100, now);
        var root = new TreatmentCatalogItem(database.TenantA, TreatmentType.RootCanal, "Root canal", "TIME-ROOT", null, 500, now);
        db.Patients.Add(patient); db.TreatmentCatalogItems.AddRange(filling, root); await db.SaveChangesAsync();
        var visit = await RootVisitAsync(scope.ServiceProvider, db, 80, patient.Id);
        var queries = scope.ServiceProvider.GetRequiredService<PatientClinicalHistoryService>();
        var first = (await queries.GetAsync(patient.Id, 1, 100, CancellationToken.None))!;
        Assert.Equal(visit.CreatedAt.ToUnixTimeMilliseconds(), first.FirstExaminationAt!.Value.ToUnixTimeMilliseconds()); Assert.Equal("examination", Assert.Single(first.Items).Step);
        var service = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
        var fillingId = await service.CreateAsync(new(patient.Id, database.DoctorA, filling.Id, visit.AppointmentId, null, null, [36],
            "Filling material: Composite", DeferBilling: true, ExecutedStep: "caries-removal"), CancellationToken.None);
        var roots = scope.ServiceProvider.GetRequiredService<RootTreatmentFlowService>();
        var saved = await roots.SaveAsync(visit.Id, 26, new(visit.Version, null, root.Id, null, RootFlowCanals,
            """{"version":1,"needsPost":false,"needsCrown":false,"progress":{"access":{"completed":true}},"crown":{"completed":[false,false,false,false,false]}}""", null, null), CancellationToken.None);
        var before = (await queries.GetAsync(patient.Id, 1, 100, CancellationToken.None))!;
        Assert.Contains(before.Items, e => e.Step == "caries-removal" && e.TreatmentId == fillingId);
        Assert.DoesNotContain(before.Items, e => e.Step is "composite-filling" or "length" or "obturation");
        var access = Assert.Single(before.Items, e => e.Step == "access");
        visit.Complete(visit.Version, now); await db.SaveChangesAsync();
        var next = await RootVisitAsync(scope.ServiceProvider, db, 81, patient.Id);
        var fillingWork = (await service.GetAsync(fillingId, CancellationToken.None))!;
        await service.TransitionAsync(fillingId, "complete", fillingWork.Version, CancellationToken.None, next.AppointmentId);
        var state = DentalClinic.Domain.Dental.RootTreatmentFlow.Parse(saved.WorkflowJson);
        state["progress"]!["length"] = new System.Text.Json.Nodes.JsonObject { ["completed"] = true };
        await roots.SaveAsync(next.Id, 26, new(next.Version, saved.TreatmentId, root.Id, null, RootFlowCanals, state.ToJsonString(), null, null), CancellationToken.None);
        var after = (await queries.GetAsync(patient.Id, 1, 100, CancellationToken.None))!;
        Assert.Equal(first.FirstExaminationAt, after.FirstExaminationAt); Assert.Equal(first.FirstExaminationDate, after.FirstExaminationDate);
        Assert.Equal(first.FirstExaminationTime, after.FirstExaminationTime); Assert.Equal(first.FirstExaminationDayAr, after.FirstExaminationDayAr);
        Assert.Equal(access.PerformedAt, Assert.Single(after.Items, e => e.Step == "access").PerformedAt);
        Assert.Equal(next.AppointmentId, Assert.Single(after.Items, e => e.Step == "composite-filling").AppointmentId);
        Assert.Contains(after.Items, e => e.Step == "length" && e.AppointmentId == next.AppointmentId); Assert.DoesNotContain(after.Items, e => e.Step == "obturation");
        Assert.Equal(after.Items.Count, after.Items.Select(e => e.Id).Distinct().Count());
        var page = (await queries.GetAsync(patient.Id, 1, 2, CancellationToken.None))!; Assert.Equal(2, page.Items.Count); Assert.Equal(after.TotalCount, page.TotalCount);
        using var other = database.Scope(database.MemberB);
        Assert.Null(await new PatientClinicalHistoryService(other.ServiceProvider.GetRequiredService<ApplicationDbContext>(), new TimelinePermission(true))
            .GetAsync(patient.Id, 1, 100, CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => new PatientClinicalHistoryService(db, new TimelinePermission(false)).GetAsync(patient.Id, 1, 100, CancellationToken.None));
    }
    private sealed class TimelinePermission(bool allow) : IPermissionService
    {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(allow);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => allow ? Task.CompletedTask : throw new ForbiddenAccessException("Clinical history is restricted.");
    }
}
