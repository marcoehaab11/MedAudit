using DentalClinic.Application.Doctors;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Reports;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Treatments;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DentalClinic.IntegrationTests;

public sealed partial class DentalWorkflowTests
{
    [Fact]
    public async Task ReportsAggregateTenantDataCorrectlyAndEnforceIsolation()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "report-tenant-a", "admin@report-a.example");
        await AcceptAsync(test, "admin@report-a.example");

        var clinicB = await CreateClinicAsync(test, "report-tenant-b", "admin@report-b.example");
        await AcceptAsync(test, "admin@report-b.example");

        SetActor(test, clinicA);
        var setupA = await CreateStartedAppointmentAsync(test, clinicA, "DocA", "PatA", "PAT-A");

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<IDoctorCompensationService>()
                .CreateAsync(new(setupA.DoctorProfileId, new(CompensationType.FixedSalaryAndPercentage, 10000, 20, Monday, null)), CancellationToken.None);

            var catalog = await scope.ServiceProvider.GetRequiredService<ITreatmentCatalogService>()
                .CreateAsync(new(TreatmentType.Filling, "Report Filling", "RPT-FILL", null, 1000), CancellationToken.None);

            var treatments = scope.ServiceProvider.GetRequiredService<ITreatmentService>();
            var txId = await treatments.CreateAsync(new(setupA.PatientId, setupA.DoctorProfileId, catalog, setupA.Id, null, null, [36], null), CancellationToken.None);
            var item = (await treatments.GetAsync(txId, CancellationToken.None))!;
            await treatments.TransitionAsync(txId, "start", item.Version, CancellationToken.None);
            item = (await treatments.GetAsync(txId, CancellationToken.None))!;
            await treatments.TransitionAsync(txId, "complete", item.Version, CancellationToken.None);

            var reports = scope.ServiceProvider.GetRequiredService<IReportServices>();
            var dashA = await reports.GetDashboardAsync(new(ReportPeriod.ThisMonth), CancellationToken.None);

            Assert.Equal(1, dashA.NewPatients);
            Assert.Equal(1, dashA.AppointmentsCount);
            Assert.Equal(1, dashA.CompletedTreatments);
            Assert.Equal(1000m, dashA.Revenue);
            Assert.Equal(200m, dashA.DoctorCompensation);

            var finA = await reports.GetFinancialAsync(new(ReportPeriod.ThisMonth), CancellationToken.None);
            Assert.Equal(1000m, finA.Revenue);
            Assert.Equal(800m, finA.NetProfit);

            var docPerfA = await reports.GetDoctorPerformanceAsync(new(ReportPeriod.ThisMonth), CancellationToken.None);
            Assert.NotEmpty(docPerfA.Doctors);
            Assert.Equal(1000m, docPerfA.Doctors[0].Revenue);
        }

        SetActor(test, clinicB);
        await using (var scopeB = test.Provider.CreateAsyncScope())
        {
            var reportsB = scopeB.ServiceProvider.GetRequiredService<IReportServices>();
            var dashB = await reportsB.GetDashboardAsync(new(ReportPeriod.ThisMonth), CancellationToken.None);

            Assert.Equal(0, dashB.NewPatients);
            Assert.Equal(0, dashB.AppointmentsCount);
            Assert.Equal(0m, dashB.Revenue);

            var (bytes, contentType, fileName) = await reportsB.ExportCsvAsync("dashboard", new(ReportPeriod.ThisMonth), CancellationToken.None);
            Assert.NotEmpty(bytes);
            Assert.Equal("text/csv; charset=utf-8", contentType);
            Assert.Equal("dashboard-report.csv", fileName);
        }
    }
}
