using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Crm;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task CrmCreatesRelatedFollowUpDerivesDashboardAndRecordsCommunication()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "crm-flow", "admin@crm-flow.example");
        await AcceptAsync(test, "admin@crm-flow.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "CRM", "Patient", "CRM-1");
        await using var scope = test.Provider.CreateAsyncScope();
        var catalogId = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Filling, "Filling", "CRM-F", null, 100), CancellationToken.None);
        var planId = await scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, "CRM plan", null, 0, [new(catalogId, 36, 1, 0, null)]), CancellationToken.None);
        var treatmentId = await scope.ServiceProvider.GetRequiredService<ITreatmentService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalogId, setup.Id, null, null, [36], null), CancellationToken.None);
        var prescriptionId = await scope.ServiceProvider.GetRequiredService<IPrescriptionService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, setup.Id, null, treatmentId, null, []), CancellationToken.None);
        var create = scope.ServiceProvider.GetRequiredService<ICreateFollowUp>();
        var id = await create.ExecuteAsync(new(setup.PatientId, clinic.AdminUserId, FollowUpType.PostTreatment, Monday, new TimeOnly(7, 0), "Check recovery", "Concise note", setup.Id, planId, treatmentId, prescriptionId), CancellationToken.None);
        var queries = scope.ServiceProvider.GetRequiredService<IFollowUpQueries>(); var details = (await queries.GetAsync(id, CancellationToken.None))!;
        Assert.True(details.IsOverdue); Assert.Equal(planId, details.RelatedTreatmentPlanId); Assert.Equal(treatmentId, details.RelatedTreatmentId); Assert.Equal(prescriptionId, details.RelatedPrescriptionId);
        var dashboard = await queries.DashboardAsync(CancellationToken.None); Assert.Equal(1, dashboard.NewPatientsToday); Assert.Equal(1, dashboard.NewPatientsThisWeek); Assert.Equal(1, dashboard.NewPatientsThisMonth); Assert.Equal(1, dashboard.OverdueFollowUps);
        var patientSummary = (await queries.PatientSummaryAsync(setup.PatientId, CancellationToken.None))!; Assert.True(patientSummary.IsNew); Assert.Equal(1, patientSummary.PendingFollowUps);
        var activities = scope.ServiceProvider.GetRequiredService<ICommunicationActivityService>();
        await activities.CreateAsync(new(setup.PatientId, CommunicationType.Call, CommunicationDirection.Outbound, "Recovery call", "Patient is comfortable", Monday, new TimeOnly(10, 0)), CancellationToken.None);
        Assert.Single(await activities.GetAsync(setup.PatientId, 20, CancellationToken.None));
        var lifecycle = scope.ServiceProvider.GetRequiredService<IFollowUpLifecycle>(); Assert.True(await lifecycle.ExecuteAsync(id, "start", details.Version, CancellationToken.None));
        details = (await queries.GetAsync(id, CancellationToken.None))!; Assert.True(await lifecycle.ExecuteAsync(id, "complete", details.Version, CancellationToken.None));
        details = (await queries.GetAsync(id, CancellationToken.None))!; await Assert.ThrowsAsync<FollowUpStateException>(() => lifecycle.ExecuteAsync(id, "start", details.Version, CancellationToken.None));
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE follow_ups SET \"Title\"='rewrite' WHERE \"Id\"={id}"));
    }

    [Fact]
    public async Task CrmTenantAssignmentClinicalReferencesAndActivitiesAreIsolated()
    {
        await using var test = await CreateContextAsync(); var alpha = await CreateClinicAsync(test, "crm-alpha", "admin@crm-alpha.example"); var beta = await CreateClinicAsync(test, "crm-beta", "admin@crm-beta.example");
        await AcceptAsync(test, "admin@crm-alpha.example"); await AcceptAsync(test, "admin@crm-beta.example"); SetActor(test, alpha); var own = await CreateStartedAppointmentAsync(test, alpha, "Alpha", "Patient", "CRMA-1");
        Guid id; await using (var scope = test.Provider.CreateAsyncScope()) { id = await scope.ServiceProvider.GetRequiredService<ICreateFollowUp>().ExecuteAsync(new(own.PatientId, alpha.AdminUserId, FollowUpType.General, Monday, new TimeOnly(12, 0), "Alpha only", null, own.Id), CancellationToken.None); await scope.ServiceProvider.GetRequiredService<ICommunicationActivityService>().CreateAsync(new(own.PatientId, CommunicationType.Call, CommunicationDirection.Outbound, null, null, Monday, new TimeOnly(11, 0)), CancellationToken.None); }
        SetActor(test, beta); var betaSetup = await CreateStartedAppointmentAsync(test, beta, "Beta", "Patient", "CRMB-1");
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var queries = scope.ServiceProvider.GetRequiredService<IFollowUpQueries>(); Assert.Null(await queries.GetAsync(id, CancellationToken.None));
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<ICommunicationActivityService>().GetAsync(own.PatientId, 10, CancellationToken.None));
            await Assert.ThrowsAsync<CrmNotFoundException>(() => scope.ServiceProvider.GetRequiredService<ICreateFollowUp>().ExecuteAsync(new(own.PatientId, beta.AdminUserId, FollowUpType.General, Monday, new TimeOnly(12, 0), "Cross patient", null), CancellationToken.None));
            await Assert.ThrowsAsync<CrmNotFoundException>(() => scope.ServiceProvider.GetRequiredService<ICreateFollowUp>().ExecuteAsync(new(betaSetup.PatientId, alpha.AdminUserId, FollowUpType.General, Monday, new TimeOnly(12, 0), "Cross user", null), CancellationToken.None));
            await Assert.ThrowsAsync<CrmNotFoundException>(() => scope.ServiceProvider.GetRequiredService<ICreateFollowUp>().ExecuteAsync(new(betaSetup.PatientId, beta.AdminUserId, FollowUpType.General, Monday, new TimeOnly(12, 0), "Cross record", null, own.Id), CancellationToken.None));
        }
        test.Tenant.Clear(); test.User.UserId = null; await using var platform = test.Provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => platform.ServiceProvider.GetRequiredService<IFollowUpQueries>().DashboardAsync(CancellationToken.None));
    }

    [Fact]
    public async Task FollowUpConcurrentUpdatesAndRoleDefaultsAreEnforced()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "crm-race", "admin@crm-race.example");
        await AcceptAsync(test, "admin@crm-race.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "Race", "Patient", "CRMR-1");
        Guid id; FollowUpDetails details; await using (var scope = test.Provider.CreateAsyncScope()) { id = await scope.ServiceProvider.GetRequiredService<ICreateFollowUp>().ExecuteAsync(new(setup.PatientId, clinic.AdminUserId, FollowUpType.General, Monday, new TimeOnly(14, 0), "Race", null), CancellationToken.None); details = (await scope.ServiceProvider.GetRequiredService<IFollowUpQueries>().GetAsync(id, CancellationToken.None))!; }
        async Task<bool> Edit(string title) { try { await using var scope = test.Provider.CreateAsyncScope(); return await scope.ServiceProvider.GetRequiredService<IUpdateFollowUp>().ExecuteAsync(new(id, new(setup.PatientId, clinic.AdminUserId, FollowUpType.General, Monday, new TimeOnly(14, 0), title, null), details.Version), CancellationToken.None); } catch (FollowUpConcurrencyException) { return false; } }
        Assert.Equal(1, (await Task.WhenAll(Edit("Writer one"), Edit("Writer two"))).Count(x => x));
        test.User.UserId = setup.DoctorUserId; await using (var denied = test.Provider.CreateAsyncScope()) { await Assert.ThrowsAsync<ForbiddenAccessException>(() => denied.ServiceProvider.GetRequiredService<IFollowUpQueries>().DashboardAsync(CancellationToken.None)); }
        SetActor(test, clinic); var receptionist = await InviteRoleAsync(test, "Reception", "reception@crm-race.example", SystemRoleDefinitions.Receptionist); await AcceptAsync(test, "reception@crm-race.example"); test.Tenant.Set(clinic.TenantId); test.User.UserId = receptionist;
        await using var allowed = test.Provider.CreateAsyncScope(); Assert.NotNull(await allowed.ServiceProvider.GetRequiredService<IFollowUpQueries>().DashboardAsync(CancellationToken.None));
        var current = (await allowed.ServiceProvider.GetRequiredService<IFollowUpQueries>().GetAsync(id, CancellationToken.None))!;
        Assert.True(await allowed.ServiceProvider.GetRequiredService<IAssignFollowUp>().ExecuteAsync(id, receptionist, current.Version, CancellationToken.None));
    }
}
