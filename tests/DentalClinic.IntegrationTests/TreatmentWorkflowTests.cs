using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task AcceptedPlanSnapshotsPriceAndCreatesImmutableCompletedTreatment()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "treatment-flow", "admin@treatment-flow.example");
        await AcceptAsync(test, "admin@treatment-flow.example"); SetActor(test, clinic);
        var setup = await CreateStartedAppointmentAsync(test, clinic, "Plan", "Patient", "TP-1");
        await using var scope = test.Provider.CreateAsyncScope();
        var catalog = scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>();
        var catalogId = await catalog.CreateAsync(new(TreatmentType.Crown, "Ceramic crown", "CR-1", null, 500m), CancellationToken.None);
        var plans = scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>();
        var planId = await plans.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, "Restoration", null, 25m,
            [new(catalogId, 11, 1, 50m, null)]), CancellationToken.None);
        await catalog.UpdateAsync(catalogId, new(TreatmentType.Crown, "Ceramic crown", "CR-1", null, 900m), CancellationToken.None);
        var plan = (await plans.GetAsync(planId, CancellationToken.None))!;
        Assert.Equal(500m, plan.Items.Single().UnitPrice); Assert.Equal(425m, plan.Total);
        Assert.True(await plans.TransitionAsync(planId, "propose", plan.Version, CancellationToken.None));
        plan = (await plans.GetAsync(planId, CancellationToken.None))!;
        Assert.True(await plans.TransitionAsync(planId, "accept", plan.Version, CancellationToken.None));
        plan = (await plans.GetAsync(planId, CancellationToken.None))!;
        await Assert.ThrowsAsync<TreatmentStateException>(() => plans.UpdateAsync(new(planId, "Rewrite", null, 0, plan.Version), CancellationToken.None));

        var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
        var treatmentId = await treatments.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalogId, setup.Id,
            plan.Items.Single().Id, null, [], "execution"), CancellationToken.None);
        var treatment = (await treatments.GetAsync(treatmentId, CancellationToken.None))!;
        Assert.Equal(450m, treatment.Price); Assert.Equal([11], treatment.ToothNumbers);
        Assert.True(await treatments.TransitionAsync(treatmentId, "start", treatment.Version, CancellationToken.None));
        treatment = (await treatments.GetAsync(treatmentId, CancellationToken.None))!;
        Assert.True(await treatments.TransitionAsync(treatmentId, "complete", treatment.Version, CancellationToken.None));
        treatment = (await treatments.GetAsync(treatmentId, CancellationToken.None))!;
        await Assert.ThrowsAsync<TreatmentStateException>(() => treatments.UpdateNotesAsync(treatmentId, "rewrite", treatment.Version, CancellationToken.None));
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE treatments SET \"Notes\" = 'rewrite' WHERE \"Id\" = {treatmentId}"));
    }

    [Fact]
    public async Task TreatmentQueriesAndReferencesRemainTenantBound()
    {
        await using var test = await CreateContextAsync();
        var alpha = await CreateClinicAsync(test, "treatment-alpha", "admin@treatment-alpha.example");
        var beta = await CreateClinicAsync(test, "treatment-beta", "admin@treatment-beta.example");
        await AcceptAsync(test, "admin@treatment-alpha.example"); await AcceptAsync(test, "admin@treatment-beta.example");
        SetActor(test, alpha); var setup = await CreateStartedAppointmentAsync(test, alpha, "Alpha", "Care", "TA-1");
        Guid catalogId; Guid planId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            catalogId = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Filling, "Filling", "F-1", null, 100m), CancellationToken.None);
            planId = await scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, "Alpha plan", null, 0, [new(catalogId, 36, 1, 0, null)]), CancellationToken.None);
        }
        SetActor(test, beta);
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.Null(await scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().GetAsync(planId, CancellationToken.None));
            await Assert.ThrowsAsync<TreatmentNotFoundException>(() => scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, "Cross tenant", null, 0, [new(catalogId, 36, 1, 0, null)]), CancellationToken.None));
        }
    }

    [Fact]
    public async Task ReceptionistCannotManageTreatmentCatalogOrPlans()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "treatment-auth", "admin@treatment-auth.example");
        await AcceptAsync(test, "admin@treatment-auth.example"); SetActor(test, clinic);
        var receptionist = await InviteRoleAsync(test, "Reception", "reception@treatment-auth.example", SystemRoleDefinitions.Receptionist);
        await AcceptAsync(test, "reception@treatment-auth.example"); test.Tenant.Set(clinic.TenantId); test.User.UserId = receptionist;
        await using var scope = test.Provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().ListAsync(false, CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<ITreatmentPlanService>().SearchAsync(new(), CancellationToken.None));
    }
}
