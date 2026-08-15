using System.Text;
using DentalClinic.Application.Reports;
using DentalClinic.Infrastructure.Services;
using Xunit;

namespace DentalClinic.UnitTests;

public sealed class ReportDomainTests
{
    [Fact]
    public void ExportDashboardCsvGeneratesValidCsvBytes()
    {
        var exporter = new CsvExportService();
        var dto = new DashboardReportDto(
            NewPatients: 5,
            AppointmentsCount: 20,
            CompletedAppointments: 15,
            CancelledAppointments: 3,
            NoShowAppointments: 2,
            CompletedTreatments: 12,
            PrescriptionsIssued: 8,
            FollowUpsCompleted: 10,
            Revenue: 15000m,
            PaymentsReceived: 12000m,
            Outstanding: 3000m,
            Expenses: 4000m,
            DoctorCompensation: 5000m,
            NetProfit: 6000m,
            Currency: "EGP",
            TimeZone: "Africa/Cairo"
        );

        var bytes = exporter.ExportDashboardCsv(dto);
        var csvText = Encoding.UTF8.GetString(bytes);

        Assert.NotEmpty(bytes);
        Assert.Contains("New Patients,5", csvText);
        Assert.Contains("Revenue,15000.00 EGP", csvText);
        Assert.Contains("Net Profit,6000.00 EGP", csvText);
    }

    [Fact]
    public void ExportProfitCsvHandlesGrowthPercentagesCorrectly()
    {
        var exporter = new CsvExportService();
        var dto = new ProfitReportDto(
            CurrentPeriod: new ProfitPeriodMetricsDto(20000m, 6000m, 4000m, 10000m),
            PreviousPeriod: new ProfitPeriodMetricsDto(10000m, 3000m, 2000m, 5000m),
            RevenueGrowthPercentage: 100.00m,
            ExpenseGrowthPercentage: 100.00m,
            ProfitGrowthPercentage: 100.00m,
            Currency: "EGP"
        );

        var bytes = exporter.ExportProfitCsv(dto);
        var csvText = Encoding.UTF8.GetString(bytes);

        Assert.Contains("Revenue,20000.00,10000.00,100.00%", csvText);
        Assert.Contains("Net Profit,10000.00,5000.00,100.00%", csvText);
    }
}
