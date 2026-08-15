namespace DentalClinic.Application.Reports;

public interface ICsvExportService
{
    byte[] ExportDashboardCsv(DashboardReportDto dto);
    byte[] ExportFinancialCsv(FinancialReportDto dto);
    byte[] ExportRevenueCsv(RevenueReportDto dto);
    byte[] ExportExpenseCsv(ExpenseReportDto dto);
    byte[] ExportProfitCsv(ProfitReportDto dto);
    byte[] ExportPatientCsv(PatientReportDto dto);
    byte[] ExportAppointmentCsv(AppointmentReportDto dto);
    byte[] ExportDoctorPerformanceCsv(DoctorPerformanceReportDto dto);
    byte[] ExportTreatmentCsv(TreatmentReportDto dto);
    byte[] ExportPrescriptionCsv(PrescriptionReportDto dto);
    byte[] ExportCrmCsv(CrmReportDto dto);
}
