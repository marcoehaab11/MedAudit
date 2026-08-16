using DentalClinic.Application.Identity;
using DentalClinic.Application.Reports;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/reports").RequireAuthorization(AuthConstants.TenantMemberPolicy);

        api.MapGet("/dashboard", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetDashboardAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/financial", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetFinancialAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsFinancial);

        api.MapGet("/revenue", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetRevenueAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsFinancial);

        api.MapGet("/expenses", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetExpenseAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsFinancial);

        api.MapGet("/profit", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetProfitAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsFinancial);

        api.MapGet("/patients", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetPatientAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/appointments", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetAppointmentAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/doctors", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetDoctorPerformanceAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/treatments", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetTreatmentAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/prescriptions", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetPrescriptionAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/crm", (
            ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
            s.GetCrmAsync(new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t))
            .RequireAuthorization(Permissions.ReportsView);

        api.MapGet("/export/{reportType}", async (
            string reportType, ReportPeriod? period, DateOnly? from, DateOnly? to, Guid? doctorId, Guid? categoryId, string? treatmentType, string? status,
            IReportServices s, CancellationToken t) =>
        {
            var (bytes, contentType, fileName) = await s.ExportCsvAsync(reportType, new(period ?? ReportPeriod.ThisMonth, from, to, doctorId, categoryId, treatmentType, status), t);
            return Results.File(bytes, contentType, fileName);
        }).RequireAuthorization(Permissions.ReportsExport).RequireRateLimiting("tenant-export");

        return endpoints;
    }
}
