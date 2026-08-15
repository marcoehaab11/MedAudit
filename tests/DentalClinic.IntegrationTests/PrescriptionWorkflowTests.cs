using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task PrescriptionSnapshotsMedicationIssuesDocumentAndIsDatabaseImmutable()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "rx-flow", "admin@rx-flow.example");
        await AcceptAsync(test, "admin@rx-flow.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "Rx", "Patient", "RXD-1");
        await using var scope = test.Provider.CreateAsyncScope(); var catalog = scope.ServiceProvider.GetRequiredService<IMedicationCatalogService>();
        var medicationId = await catalog.CreateAsync(new("Amoxicillin", "Amoxicillin", "500 mg", MedicationForm.Capsule, null), CancellationToken.None);
        var service = scope.ServiceProvider.GetRequiredService<IPrescriptionService>();
        var id = await service.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, setup.Id, null, null, "reviewed",
            [new(medicationId, null, null, null, null, "500 mg", "Every 8 hours", "5 days", "Oral", "After meals", 15, 1)]), CancellationToken.None);
        await catalog.UpdateAsync(medicationId, new("Changed", null, "1 g", MedicationForm.Tablet, null, false), CancellationToken.None);
        var draft = (await service.GetAsync(id, CancellationToken.None))!; Assert.Equal("Amoxicillin", draft.Items.Single().MedicationName); Assert.Equal("500 mg", draft.Items.Single().Strength);
        Assert.True(await service.IssueAsync(id, draft.Version, CancellationToken.None)); var issued = (await service.GetAsync(id, CancellationToken.None))!;
        Assert.NotNull(issued.DocumentReference); Assert.DoesNotContain(issued.PatientName, issued.DocumentReference!, StringComparison.OrdinalIgnoreCase);
        var pdf = await service.DownloadAsync(id, false, CancellationToken.None); Assert.NotNull(pdf); Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(pdf!.Content, 0, 4));
        Assert.Contains("<svg", await service.GetQrSvgAsync(id, CancellationToken.None) ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        await Assert.ThrowsAsync<PrescriptionStateException>(() => service.UpdateAsync(new(id, setup.PatientId, setup.DoctorProfileId, setup.Id, null, null, "rewrite", issued.Version), CancellationToken.None));
        await using var db = CreateDbContext(test.ConnectionString, clinic.TenantId);
        await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE prescriptions SET \"Notes\"='rewrite' WHERE \"Id\"={id}"));
    }

    [Fact]
    public async Task PrescriptionNumbersAreUniqueAndMonotonicUnderConcurrency()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "rx-number", "admin@rx-number.example");
        await AcceptAsync(test, "admin@rx-number.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "Number", "Patient", "RXN-1");
        async Task<Guid> CreateOne() { await using var scope = test.Provider.CreateAsyncScope(); return await scope.ServiceProvider.GetRequiredService<IPrescriptionService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, null, null, null, null, []), CancellationToken.None); }
        var ids = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => CreateOne()));
        await using var read = test.Provider.CreateAsyncScope(); var service = read.ServiceProvider.GetRequiredService<IPrescriptionService>();
        var page = await service.SearchAsync(new(PageSize: 100), CancellationToken.None);
        var numbers = page.Items.Where(x => ids.Contains(x.Id)).Select(x => x.PrescriptionNumber).ToArray();
        Assert.Equal(12, numbers.Distinct().Count()); Assert.Equal(Enumerable.Range(1, 12), numbers.Select(x => int.Parse(x[3..], System.Globalization.CultureInfo.InvariantCulture)).Order());
    }

    [Fact]
    public async Task PrescriptionAcceptsMatchingAppointmentExaminationAndTreatmentAssociations()
    {
        await using var test = await CreateContextAsync(); var clinic = await CreateClinicAsync(test, "rx-associations", "admin@rx-associations.example");
        await AcceptAsync(test, "admin@rx-associations.example"); SetActor(test, clinic); var setup = await CreateStartedAppointmentAsync(test, clinic, "Association", "Patient", "RXR-1");
        await using var scope = test.Provider.CreateAsyncScope();
        var examinationId = await scope.ServiceProvider.GetRequiredService<IExaminationCommands>().CreateAsync(setup.Id, CancellationToken.None);
        var catalogId = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>().CreateAsync(new(TreatmentType.Filling, "Filling", "RX-F", null, 100m), CancellationToken.None);
        var treatmentId = await scope.ServiceProvider.GetRequiredService<ITreatmentService>().CreateAsync(new(setup.PatientId, setup.DoctorProfileId, catalogId, setup.Id, null, null, [36], null), CancellationToken.None);
        var prescriptions = scope.ServiceProvider.GetRequiredService<IPrescriptionService>();
        var prescriptionId = await prescriptions.CreateAsync(new(setup.PatientId, setup.DoctorProfileId, setup.Id, examinationId, treatmentId, null, []), CancellationToken.None);
        var prescription = (await prescriptions.GetAsync(prescriptionId, CancellationToken.None))!;
        Assert.Equal(setup.Id, prescription.AppointmentId); Assert.Equal(examinationId, prescription.ExaminationId); Assert.Equal(treatmentId, prescription.TreatmentId);
    }

    [Fact]
    public async Task PrescriptionTenantAuthorizationAssociationAndConcurrencyAreEnforced()
    {
        await using var test = await CreateContextAsync(); var alpha = await CreateClinicAsync(test, "rx-alpha", "admin@rx-alpha.example"); var beta = await CreateClinicAsync(test, "rx-beta", "admin@rx-beta.example");
        await AcceptAsync(test, "admin@rx-alpha.example"); await AcceptAsync(test, "admin@rx-beta.example"); SetActor(test, alpha); var own = await CreateStartedAppointmentAsync(test, alpha, "Alpha", "Patient", "RXA-1"); var other = await CreateStartedAppointmentAsync(test, alpha, "Other", "Patient", "RXA-2");
        Guid id; Guid version; await using (var scope = test.Provider.CreateAsyncScope()) { var catalog = scope.ServiceProvider.GetRequiredService<IMedicationCatalogService>(); await catalog.CreateAsync(new("Alpha-only medication", null, null, null, null), CancellationToken.None); var service = scope.ServiceProvider.GetRequiredService<IPrescriptionService>(); id = await service.CreateAsync(new(own.PatientId, own.DoctorProfileId, own.Id, null, null, null, []), CancellationToken.None); version = (await service.GetAsync(id, CancellationToken.None))!.Version; await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(new(other.PatientId, own.DoctorProfileId, own.Id, null, null, null, []), CancellationToken.None)); }
        async Task<bool> Edit(string notes) { try { await using var scope = test.Provider.CreateAsyncScope(); return await scope.ServiceProvider.GetRequiredService<IPrescriptionService>().UpdateAsync(new(id, own.PatientId, own.DoctorProfileId, own.Id, null, null, notes, version), CancellationToken.None); } catch (PrescriptionConcurrencyException) { return false; } }
        Assert.Equal(1, (await Task.WhenAll(Edit("one"), Edit("two"))).Count(x => x)); SetActor(test, beta);
        await using (var scope = test.Provider.CreateAsyncScope()) { var service = scope.ServiceProvider.GetRequiredService<IPrescriptionService>(); Assert.Null(await service.GetAsync(id, CancellationToken.None)); Assert.Null(await service.DownloadAsync(id, false, CancellationToken.None)); Assert.False(await service.IssueAsync(id, version, CancellationToken.None)); Assert.Empty((await scope.ServiceProvider.GetRequiredService<IMedicationCatalogService>().SearchAsync(new("Alpha-only medication"), CancellationToken.None)).Items); await Assert.ThrowsAsync<PrescriptionNotFoundException>(() => service.CreateAsync(new(own.PatientId, own.DoctorProfileId, null, null, null, null, []), CancellationToken.None)); }
        SetActor(test, alpha); var receptionist = await InviteRoleAsync(test, "Reception", "reception@rx-alpha.example", SystemRoleDefinitions.Receptionist); await AcceptAsync(test, "reception@rx-alpha.example"); test.Tenant.Set(alpha.TenantId); test.User.UserId = receptionist;
        await using var denied = test.Provider.CreateAsyncScope(); await Assert.ThrowsAsync<ForbiddenAccessException>(() => denied.ServiceProvider.GetRequiredService<IPrescriptionService>().SearchAsync(new(), CancellationToken.None));
    }
}
