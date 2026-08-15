namespace DentalClinic.Application.Reports;

public record ReportRange(
    DateTimeOffset FromUtc,
    DateTimeOffset ToUtc,
    DateTimeOffset PrevFromUtc,
    DateTimeOffset PrevToUtc,
    string TimeZone,
    string Currency
);

public interface IReportStore
{
    Task<ReportRange> ResolveRangeAsync(ReportRequestFilter filter, CancellationToken token);
    Task<DashboardReportDto> GetDashboardReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token);
    Task<FinancialReportDto> GetFinancialReportAsync(ReportRequestFilter filter, CancellationToken token);
    Task<RevenueReportDto> GetRevenueReportAsync(ReportRequestFilter filter, CancellationToken token);
    Task<ExpenseReportDto> GetExpenseReportAsync(ReportRequestFilter filter, CancellationToken token);
    Task<ProfitReportDto> GetProfitReportAsync(ReportRequestFilter filter, CancellationToken token);
    Task<PatientReportDto> GetPatientReportAsync(ReportRequestFilter filter, CancellationToken token);
    Task<AppointmentReportDto> GetAppointmentReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token);
    Task<DoctorPerformanceReportDto> GetDoctorPerformanceReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token);
    Task<TreatmentReportDto> GetTreatmentReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token);
    Task<PrescriptionReportDto> GetPrescriptionReportAsync(ReportRequestFilter filter, Guid? doctorRestrictionId, CancellationToken token);
    Task<CrmReportDto> GetCrmReportAsync(ReportRequestFilter filter, CancellationToken token);
}
