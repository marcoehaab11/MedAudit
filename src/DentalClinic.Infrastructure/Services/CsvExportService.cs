using System.Globalization;
using System.Text;
using DentalClinic.Application.Reports;

namespace DentalClinic.Infrastructure.Services;

public sealed class CsvExportService : ICsvExportService
{
    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    public byte[] ExportDashboardCsv(DashboardReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Metric,Value");
        sb.AppendLine(CultureInfo.InvariantCulture, $"New Patients,{dto.NewPatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Appointments Total,{dto.AppointmentsCount}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Appointments Completed,{dto.CompletedAppointments}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Appointments Cancelled,{dto.CancelledAppointments}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Appointments No-Show,{dto.NoShowAppointments}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Treatments Completed,{dto.CompletedTreatments}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Prescriptions Issued,{dto.PrescriptionsIssued}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Follow-ups Completed,{dto.FollowUpsCompleted}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue,{dto.Revenue.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Payments Received,{dto.PaymentsReceived.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Outstanding,{dto.Outstanding.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Expenses,{dto.Expenses.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor Compensation,{dto.DoctorCompensation.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Net Profit,{dto.NetProfit.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportFinancialCsv(FinancialReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Metric,Amount,Currency");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue,{dto.Revenue.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Payments Received,{dto.Payments.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Outstanding Balance,{dto.Outstanding.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Expenses,{dto.Expenses.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor Compensation Cost,{dto.DoctorCompensation.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Net Profit,{dto.NetProfit.ToString("F2", CultureInfo.InvariantCulture)},{EscapeCsv(dto.Currency)}");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportRevenueCsv(RevenueReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Revenue,{dto.TotalRevenue.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue By Period");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Period,Amount");
        foreach (var p in dto.ByPeriod)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(p.Period)},{p.Amount.ToString("F2", CultureInfo.InvariantCulture)}");

        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue By Doctor");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor ID,Doctor Name,Revenue");
        foreach (var d in dto.ByDoctor)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{d.DoctorId},{EscapeCsv(d.DoctorName)},{d.Revenue.ToString("F2", CultureInfo.InvariantCulture)}");

        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue By Treatment");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Treatment Type,Count,Revenue");
        foreach (var t in dto.ByTreatment)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(t.TreatmentType)},{t.Count},{t.Revenue.ToString("F2", CultureInfo.InvariantCulture)}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportExpenseCsv(ExpenseReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Expenses,{dto.TotalExpenses.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Expenses By Category");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Category ID,Category Name,Amount");
        foreach (var c in dto.ByCategory)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{c.CategoryId},{EscapeCsv(c.CategoryName)},{c.Amount.ToString("F2", CultureInfo.InvariantCulture)}");

        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Expenses By Month");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Month,Amount");
        foreach (var m in dto.ByMonth)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(m.Month)},{m.Amount.ToString("F2", CultureInfo.InvariantCulture)}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportProfitCsv(ProfitReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Metric,Current Period,Previous Period,Growth (%)");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Revenue,{dto.CurrentPeriod.Revenue.ToString("F2", CultureInfo.InvariantCulture)},{dto.PreviousPeriod.Revenue.ToString("F2", CultureInfo.InvariantCulture)},{dto.RevenueGrowthPercentage.ToString("F2", CultureInfo.InvariantCulture)}%");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor Cost,{dto.CurrentPeriod.DoctorCompensation.ToString("F2", CultureInfo.InvariantCulture)},{dto.PreviousPeriod.DoctorCompensation.ToString("F2", CultureInfo.InvariantCulture)},-");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Operating Expenses,{dto.CurrentPeriod.OperatingExpenses.ToString("F2", CultureInfo.InvariantCulture)},{dto.PreviousPeriod.OperatingExpenses.ToString("F2", CultureInfo.InvariantCulture)},{dto.ExpenseGrowthPercentage.ToString("F2", CultureInfo.InvariantCulture)}%");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Net Profit,{dto.CurrentPeriod.NetProfit.ToString("F2", CultureInfo.InvariantCulture)},{dto.PreviousPeriod.NetProfit.ToString("F2", CultureInfo.InvariantCulture)},{dto.ProfitGrowthPercentage.ToString("F2", CultureInfo.InvariantCulture)}%");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportPatientCsv(PatientReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"New Patients,{dto.NewPatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Returning Patients,{dto.ReturningPatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Active Patients,{dto.ActivePatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Archived Patients,{dto.ArchivedPatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Patients,{dto.TotalPatients}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Patient Growth Rate,{dto.PatientGrowthPercentage.ToString("F2", CultureInfo.InvariantCulture)}%");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"New Patients By Month");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Month,Count");
        foreach (var m in dto.NewPatientsByMonth)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(m.Period)},{m.Count}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportAppointmentCsv(AppointmentReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Appointments,{dto.TotalAppointments}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Scheduled,{dto.Scheduled}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Confirmed,{dto.Confirmed}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Checked In,{dto.CheckedIn}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"In Progress,{dto.InProgress}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Completed,{dto.Completed}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Cancelled,{dto.Cancelled}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"No Show,{dto.NoShow}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Completion Rate,{dto.CompletionRate.ToString("F2", CultureInfo.InvariantCulture)}%");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Cancellation Rate,{dto.CancellationRate.ToString("F2", CultureInfo.InvariantCulture)}%");
        sb.AppendLine(CultureInfo.InvariantCulture, $"No Show Rate,{dto.NoShowRate.ToString("F2", CultureInfo.InvariantCulture)}%");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportDoctorPerformanceCsv(DoctorPerformanceReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor ID,Doctor Name,Appointments Total,Completed,Cancelled,No Show,Treatments Completed,Revenue,Doctor Compensation Cost");
        foreach (var d in dto.Doctors)
        {
            sb.AppendLine(CultureInfo.InvariantCulture, $"{d.DoctorId},{EscapeCsv(d.DoctorName)},{d.AppointmentsCount},{d.CompletedAppointments},{d.CancelledAppointments},{d.NoShowAppointments},{d.CompletedTreatments},{d.Revenue.ToString("F2", CultureInfo.InvariantCulture)},{d.DoctorCompensationCost.ToString("F2", CultureInfo.InvariantCulture)}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportTreatmentCsv(TreatmentReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Treatments,{dto.TotalCount}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Completed,{dto.CompletedCount}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Cancelled,{dto.CancelledCount}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Total Revenue,{dto.TotalRevenue.ToString("F2", CultureInfo.InvariantCulture)} {EscapeCsv(dto.Currency)}");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Treatments By Type");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Type Name,Count");
        foreach (var t in dto.ByType)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(t.TypeName)},{t.Count}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportPrescriptionCsv(PrescriptionReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Prescriptions Issued,{dto.TotalIssued}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Prescriptions Cancelled,{dto.TotalCancelled}");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Prescriptions By Doctor");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Doctor ID,Doctor Name,Count");
        foreach (var d in dto.ByDoctor)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{d.DoctorId},{EscapeCsv(d.DoctorName)},{d.Count}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportCrmCsv(CrmReportDto dto)
    {
        var sb = new StringBuilder();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Follow-ups Created,{dto.FollowUpsCreated}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Follow-ups Completed,{dto.FollowUpsCompleted}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Pending Follow-ups,{dto.PendingFollowUps}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Overdue Follow-ups,{dto.OverdueFollowUps}");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Cancelled Follow-ups,{dto.CancelledFollowUps}");
        sb.AppendLine();
        sb.AppendLine(CultureInfo.InvariantCulture, $"Follow-ups By Type");
        sb.AppendLine(CultureInfo.InvariantCulture, $"Type,Count");
        foreach (var t in dto.ByType)
            sb.AppendLine(CultureInfo.InvariantCulture, $"{EscapeCsv(t.FollowUpType)},{t.Count}");

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
