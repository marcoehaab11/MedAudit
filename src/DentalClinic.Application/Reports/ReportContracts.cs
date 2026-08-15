namespace DentalClinic.Application.Reports;

public enum ReportPeriod
{
    Today = 0,
    ThisWeek = 1,
    ThisMonth = 2,
    ThisYear = 3,
    Custom = 4
}

public record ReportRequestFilter(
    ReportPeriod Period = ReportPeriod.ThisMonth,
    DateOnly? From = null,
    DateOnly? To = null,
    Guid? DoctorId = null,
    Guid? CategoryId = null,
    string? TreatmentType = null,
    string? Status = null
);

public record DashboardReportDto(
    int NewPatients,
    int AppointmentsCount,
    int CompletedAppointments,
    int CancelledAppointments,
    int NoShowAppointments,
    int CompletedTreatments,
    int PrescriptionsIssued,
    int FollowUpsCompleted,
    decimal Revenue,
    decimal PaymentsReceived,
    decimal Outstanding,
    decimal Expenses,
    decimal DoctorCompensation,
    decimal NetProfit,
    string Currency,
    string TimeZone
);

public record FinancialReportDto(
    decimal Revenue,
    decimal Payments,
    decimal Outstanding,
    decimal Expenses,
    decimal DoctorCompensation,
    decimal NetProfit,
    string Currency
);

public record RevenueByPeriodDto(string Period, decimal Amount);
public record RevenueByDoctorDto(Guid DoctorId, string DoctorName, decimal Revenue);
public record RevenueByTreatmentDto(string TreatmentType, decimal Revenue, int Count);
public record RevenueByCategoryDto(Guid CategoryId, string CategoryName, decimal Revenue);

public record RevenueReportDto(
    decimal TotalRevenue,
    IReadOnlyList<RevenueByPeriodDto> ByPeriod,
    IReadOnlyList<RevenueByDoctorDto> ByDoctor,
    IReadOnlyList<RevenueByTreatmentDto> ByTreatment,
    IReadOnlyList<RevenueByCategoryDto> ByCategory,
    string Currency
);

public record ExpensesByCategoryDto(Guid CategoryId, string CategoryName, decimal Amount);
public record ExpensesByMonthDto(string Month, decimal Amount);

public record ExpenseReportDto(
    decimal TotalExpenses,
    IReadOnlyList<ExpensesByCategoryDto> ByCategory,
    IReadOnlyList<ExpensesByMonthDto> ByMonth,
    IReadOnlyList<ExpensesByCategoryDto> TopCategories,
    string Currency
);

public record ProfitPeriodMetricsDto(
    decimal Revenue,
    decimal DoctorCompensation,
    decimal OperatingExpenses,
    decimal NetProfit
);

public record ProfitReportDto(
    ProfitPeriodMetricsDto CurrentPeriod,
    ProfitPeriodMetricsDto PreviousPeriod,
    decimal RevenueGrowthPercentage,
    decimal ExpenseGrowthPercentage,
    decimal ProfitGrowthPercentage,
    string Currency
);

public record NewPatientsByPeriodDto(string Period, int Count);

public record PatientReportDto(
    int NewPatients,
    int ReturningPatients,
    int ActivePatients,
    int ArchivedPatients,
    int TotalPatients,
    IReadOnlyList<NewPatientsByPeriodDto> NewPatientsByMonth,
    decimal PatientGrowthPercentage
);

public record AppointmentStatusCountDto(string Status, int Count);

public record AppointmentReportDto(
    int TotalAppointments,
    int Scheduled,
    int Confirmed,
    int CheckedIn,
    int InProgress,
    int Completed,
    int Cancelled,
    int NoShow,
    decimal CompletionRate,
    decimal CancellationRate,
    decimal NoShowRate,
    IReadOnlyList<AppointmentStatusCountDto> ByStatus
);

public record DoctorPerformanceItemDto(
    Guid DoctorId,
    string DoctorName,
    int AppointmentsCount,
    int CompletedAppointments,
    int CancelledAppointments,
    int NoShowAppointments,
    int CompletedTreatments,
    decimal Revenue,
    decimal DoctorCompensationCost
);

public record DoctorPerformanceReportDto(
    IReadOnlyList<DoctorPerformanceItemDto> Doctors,
    string Currency
);

public record TreatmentsByTypeDto(string TypeName, int Count, decimal Revenue);
public record TreatmentsByDoctorDto(Guid DoctorId, string DoctorName, int Count, decimal Revenue);
public record TreatmentsByMonthDto(string Month, int Count, decimal Revenue);

public record TreatmentReportDto(
    int TotalCount,
    int CompletedCount,
    int CancelledCount,
    decimal TotalRevenue,
    IReadOnlyList<TreatmentsByTypeDto> ByType,
    IReadOnlyList<TreatmentsByDoctorDto> ByDoctor,
    IReadOnlyList<TreatmentsByMonthDto> ByMonth,
    string Currency
);

public record PrescriptionsByMonthDto(string Month, int Count);
public record PrescriptionsByDoctorDto(Guid DoctorId, string DoctorName, int Count);

public record PrescriptionReportDto(
    int TotalIssued,
    int TotalCancelled,
    IReadOnlyList<PrescriptionsByMonthDto> ByMonth,
    IReadOnlyList<PrescriptionsByDoctorDto> ByDoctor
);

public record FollowUpsByTypeDto(string FollowUpType, int Count);
public record FollowUpsByAssigneeDto(Guid? AssigneeId, string AssigneeName, int Count);

public record CrmReportDto(
    int FollowUpsCreated,
    int FollowUpsCompleted,
    int PendingFollowUps,
    int OverdueFollowUps,
    int CancelledFollowUps,
    IReadOnlyList<FollowUpsByTypeDto> ByType,
    IReadOnlyList<FollowUpsByAssigneeDto> ByAssignee
);
