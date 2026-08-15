namespace DentalClinic.Application.Reports;

public interface IReportServices
{
    Task<DashboardReportDto> GetDashboardAsync(ReportRequestFilter filter, CancellationToken token);
    Task<FinancialReportDto> GetFinancialAsync(ReportRequestFilter filter, CancellationToken token);
    Task<RevenueReportDto> GetRevenueAsync(ReportRequestFilter filter, CancellationToken token);
    Task<ExpenseReportDto> GetExpenseAsync(ReportRequestFilter filter, CancellationToken token);
    Task<ProfitReportDto> GetProfitAsync(ReportRequestFilter filter, CancellationToken token);
    Task<PatientReportDto> GetPatientAsync(ReportRequestFilter filter, CancellationToken token);
    Task<AppointmentReportDto> GetAppointmentAsync(ReportRequestFilter filter, CancellationToken token);
    Task<DoctorPerformanceReportDto> GetDoctorPerformanceAsync(ReportRequestFilter filter, CancellationToken token);
    Task<TreatmentReportDto> GetTreatmentAsync(ReportRequestFilter filter, CancellationToken token);
    Task<PrescriptionReportDto> GetPrescriptionAsync(ReportRequestFilter filter, CancellationToken token);
    Task<CrmReportDto> GetCrmAsync(ReportRequestFilter filter, CancellationToken token);
    Task<(byte[] FileBytes, string ContentType, string FileName)> ExportCsvAsync(string reportType, ReportRequestFilter filter, CancellationToken token);
}
