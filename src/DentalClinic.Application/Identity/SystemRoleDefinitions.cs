namespace DentalClinic.Application.Identity;

public static class SystemRoleDefinitions
{
    public const string ClinicAdmin = "ClinicAdmin";
    public const string Doctor = "Doctor";
    public const string Receptionist = "Receptionist";

    public static IReadOnlyDictionary<string, IReadOnlyCollection<string>> Roles { get; } =
        new Dictionary<string, IReadOnlyCollection<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [ClinicAdmin] = Permissions.All.Order(StringComparer.Ordinal).ToArray(),
            [Doctor] =
            [
                Permissions.PatientsView,
                Permissions.PatientsCreate,
                Permissions.PatientsEdit,
                Permissions.PatientsViewMedicalHistory,
                Permissions.PatientsEditMedicalHistory,
                Permissions.DoctorsView,
                Permissions.AppointmentsView,
                Permissions.AppointmentsStart,
                Permissions.AppointmentsComplete,
                Permissions.DentalView,
                Permissions.DentalCreate,
                Permissions.DentalEdit,
                Permissions.ExaminationView,
                Permissions.ExaminationCreate,
                Permissions.ExaminationEdit,
                Permissions.ExaminationComplete,
                Permissions.DentalHistoryView,
                Permissions.DentalHistoryEdit,
                Permissions.TreatmentsView,
                Permissions.TreatmentsCreate,
                Permissions.TreatmentsEdit,
                Permissions.TreatmentsApprove,
                Permissions.TreatmentsComplete,
                Permissions.TreatmentsStart,
                Permissions.TreatmentsCancel,
                Permissions.TreatmentPlansView,
                Permissions.TreatmentPlansCreate,
                Permissions.TreatmentPlansEdit,
                Permissions.TreatmentPlansPropose,
                Permissions.TreatmentPlansAccept,
                Permissions.TreatmentPlansReject,
                Permissions.TreatmentPlansCancel,
                Permissions.TreatmentCatalogView,
                Permissions.PrescriptionsView,
                Permissions.PrescriptionsCreate,
                Permissions.PrescriptionsEdit,
                Permissions.PrescriptionsIssue,
                Permissions.PrescriptionsCancel,
                Permissions.PrescriptionsPrint,
                Permissions.PrescriptionsDownload,
                Permissions.ReportsView,
                Permissions.ReportsPatients,
                Permissions.ReportsAppointments,
                Permissions.ReportsDoctors,
                Permissions.ReportsTreatments,
                Permissions.ReportsPrescriptions,
                Permissions.NotificationsView,
                Permissions.InventoryView,
                Permissions.InventoryIssue
            ],
            [Receptionist] =
            [
                Permissions.PatientsView,
                Permissions.PatientsCreate,
                Permissions.PatientsEdit,
                Permissions.AppointmentsView,
                Permissions.AppointmentsCreate,
                Permissions.AppointmentsEdit,
                Permissions.AppointmentsCancel,
                Permissions.AppointmentsCheckIn,
                Permissions.AppointmentsMarkNoShow,
                Permissions.AppointmentsManageSchedule,
                Permissions.CrmView,
                Permissions.CrmCreateFollowUp,
                Permissions.CrmEditFollowUp,
                Permissions.CrmAssignFollowUp,
                Permissions.CrmCompleteFollowUp,
                Permissions.CrmCancelFollowUp,
                Permissions.CrmViewActivities,
                Permissions.CrmCreateActivity,
                Permissions.FinanceView,
                Permissions.FinanceRevenueView,
                Permissions.FinancePaymentsView,
                Permissions.FinancePaymentsCreate,
                Permissions.ReportsView,
                Permissions.ReportsPatients,
                Permissions.ReportsAppointments,
                Permissions.ReportsTreatments,
                Permissions.ReportsPrescriptions,
                Permissions.ReportsCrm,
                Permissions.NotificationsView,
                Permissions.InventoryView,
                Permissions.InventoryReceive,
                Permissions.InventoryIssue
            ]
        };
}
