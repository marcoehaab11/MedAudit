using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;

namespace DentalClinic.Application.Reports;

internal sealed class ReportServices(
    IReportStore store,
    IDoctorProfileStore doctorStore,
    IPermissionService permissions,
    ICsvExportService csvExporter,
    ICurrentUser currentUser
) : IReportServices
{
    private async Task<Guid?> GetDoctorRestrictionIdAsync(CancellationToken token)
    {
        var canViewAllFinancials = await permissions.HasPermissionAsync(Permissions.ReportsFinancial, token);
        var canViewAllDoctors = await permissions.HasPermissionAsync(Permissions.ReportsDoctors, token);

        if (canViewAllFinancials || canViewAllDoctors)
        {
            return null;
        }

        if (currentUser.UserId.HasValue)
        {
            var profile = await doctorStore.FindByUserIdAsync(currentUser.UserId.Value, token);
            if (profile != null)
            {
                return profile.Id;
            }
        }

        return null;
    }

    public async Task<DashboardReportDto> GetDashboardAsync(ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsView, token);
        var doctorRestrictionId = await GetDoctorRestrictionIdAsync(token);
        return await store.GetDashboardReportAsync(filter, doctorRestrictionId, token);
    }

    public async Task<FinancialReportDto> GetFinancialAsync(ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsFinancial, token);
        return await store.GetFinancialReportAsync(filter, token);
    }

    public async Task<RevenueReportDto> GetRevenueAsync(ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsFinancial, token);
        return await store.GetRevenueReportAsync(filter, token);
    }

    public async Task<ExpenseReportDto> GetExpenseAsync(ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsFinancial, token);
        return await store.GetExpenseReportAsync(filter, token);
    }

    public async Task<ProfitReportDto> GetProfitAsync(ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsFinancial, token);
        return await store.GetProfitReportAsync(filter, token);
    }

    public async Task<PatientReportDto> GetPatientAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasPatientPermission = await permissions.HasPermissionAsync(Permissions.ReportsPatients, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasPatientPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsPatients, token);
        }

        return await store.GetPatientReportAsync(filter, token);
    }

    public async Task<AppointmentReportDto> GetAppointmentAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasApptPermission = await permissions.HasPermissionAsync(Permissions.ReportsAppointments, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasApptPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsAppointments, token);
        }

        var doctorRestrictionId = await GetDoctorRestrictionIdAsync(token);
        return await store.GetAppointmentReportAsync(filter, doctorRestrictionId, token);
    }

    public async Task<DoctorPerformanceReportDto> GetDoctorPerformanceAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasDocPermission = await permissions.HasPermissionAsync(Permissions.ReportsDoctors, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasDocPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsDoctors, token);
        }

        var doctorRestrictionId = await GetDoctorRestrictionIdAsync(token);
        return await store.GetDoctorPerformanceReportAsync(filter, doctorRestrictionId, token);
    }

    public async Task<TreatmentReportDto> GetTreatmentAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasTxPermission = await permissions.HasPermissionAsync(Permissions.ReportsTreatments, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasTxPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsTreatments, token);
        }

        var doctorRestrictionId = await GetDoctorRestrictionIdAsync(token);
        return await store.GetTreatmentReportAsync(filter, doctorRestrictionId, token);
    }

    public async Task<PrescriptionReportDto> GetPrescriptionAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasRxPermission = await permissions.HasPermissionAsync(Permissions.ReportsPrescriptions, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasRxPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsPrescriptions, token);
        }

        var doctorRestrictionId = await GetDoctorRestrictionIdAsync(token);
        return await store.GetPrescriptionReportAsync(filter, doctorRestrictionId, token);
    }

    public async Task<CrmReportDto> GetCrmAsync(ReportRequestFilter filter, CancellationToken token)
    {
        var hasCrmPermission = await permissions.HasPermissionAsync(Permissions.ReportsCrm, token);
        var hasViewPermission = await permissions.HasPermissionAsync(Permissions.ReportsView, token);
        if (!hasCrmPermission && !hasViewPermission)
        {
            await permissions.EnsurePermissionAsync(Permissions.ReportsCrm, token);
        }

        return await store.GetCrmReportAsync(filter, token);
    }

    public async Task<(byte[] FileBytes, string ContentType, string FileName)> ExportCsvAsync(string reportType, ReportRequestFilter filter, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.ReportsExport, token);

        var normalizedType = reportType.Trim().ToLowerInvariant();
        byte[] bytes;
        string fileName;

        switch (normalizedType)
        {
            case "dashboard":
                var dash = await GetDashboardAsync(filter, token);
                bytes = csvExporter.ExportDashboardCsv(dash);
                fileName = "dashboard-report.csv";
                break;
            case "financial":
                var fin = await GetFinancialAsync(filter, token);
                bytes = csvExporter.ExportFinancialCsv(fin);
                fileName = "financial-report.csv";
                break;
            case "revenue":
                var rev = await GetRevenueAsync(filter, token);
                bytes = csvExporter.ExportRevenueCsv(rev);
                fileName = "revenue-report.csv";
                break;
            case "expenses":
                var exp = await GetExpenseAsync(filter, token);
                bytes = csvExporter.ExportExpenseCsv(exp);
                fileName = "expenses-report.csv";
                break;
            case "profit":
                var prof = await GetProfitAsync(filter, token);
                bytes = csvExporter.ExportProfitCsv(prof);
                fileName = "profit-report.csv";
                break;
            case "patients":
                var pat = await GetPatientAsync(filter, token);
                bytes = csvExporter.ExportPatientCsv(pat);
                fileName = "patient-report.csv";
                break;
            case "appointments":
                var appt = await GetAppointmentAsync(filter, token);
                bytes = csvExporter.ExportAppointmentCsv(appt);
                fileName = "appointment-report.csv";
                break;
            case "doctors":
                var doc = await GetDoctorPerformanceAsync(filter, token);
                bytes = csvExporter.ExportDoctorPerformanceCsv(doc);
                fileName = "doctor-performance-report.csv";
                break;
            case "treatments":
                var tx = await GetTreatmentAsync(filter, token);
                bytes = csvExporter.ExportTreatmentCsv(tx);
                fileName = "treatment-report.csv";
                break;
            case "prescriptions":
                var rx = await GetPrescriptionAsync(filter, token);
                bytes = csvExporter.ExportPrescriptionCsv(rx);
                fileName = "prescription-report.csv";
                break;
            case "crm":
                var crm = await GetCrmAsync(filter, token);
                bytes = csvExporter.ExportCrmCsv(crm);
                fileName = "crm-report.csv";
                break;
            default:
                throw new ArgumentException($"Unknown report type '{reportType}'.");
        }

        return (bytes, "text/csv; charset=utf-8", fileName);
    }
}
