namespace DentalClinic.Application.Identity;

public static class Permissions
{
    public const string PatientsView = "Patients.View";
    public const string PatientsCreate = "Patients.Create";
    public const string PatientsEdit = "Patients.Edit";
    public const string PatientsArchive = "Patients.Archive";
    public const string PatientsViewMedicalHistory = "Patients.ViewMedicalHistory";
    public const string PatientsEditMedicalHistory = "Patients.EditMedicalHistory";
    public const string DoctorsView = "Doctors.View";
    public const string DoctorsCreate = "Doctors.Create";
    public const string DoctorsEdit = "Doctors.Edit";
    public const string DoctorsArchive = "Doctors.Archive";
    public const string DoctorsManageSchedule = "Doctors.ManageSchedule";
    public const string DoctorsManageCompensation = "Doctors.ManageCompensation";
    public const string AppointmentsView = "Appointments.View";
    public const string AppointmentsCreate = "Appointments.Create";
    public const string AppointmentsEdit = "Appointments.Edit";
    public const string AppointmentsCancel = "Appointments.Cancel";
    public const string AppointmentsCheckIn = "Appointments.CheckIn";
    public const string AppointmentsStart = "Appointments.Start";
    public const string AppointmentsComplete = "Appointments.Complete";
    public const string AppointmentsMarkNoShow = "Appointments.MarkNoShow";
    public const string AppointmentsManageSchedule = "Appointments.ManageSchedule";
    public const string DentalView = "Dental.View";
    public const string DentalCreate = "Dental.Create";
    public const string DentalEdit = "Dental.Edit";
    public const string ExaminationView = "Examination.View";
    public const string ExaminationCreate = "Examination.Create";
    public const string ExaminationEdit = "Examination.Edit";
    public const string ExaminationComplete = "Examination.Complete";
    public const string DentalHistoryView = "DentalHistory.View";
    public const string DentalHistoryEdit = "DentalHistory.Edit";
    public const string TreatmentsView = "Treatments.View";
    public const string TreatmentsCreate = "Treatments.Create";
    public const string TreatmentsEdit = "Treatments.Edit";
    public const string TreatmentsApprove = "Treatments.Approve";
    public const string TreatmentsComplete = "Treatments.Complete";
    public const string TreatmentsStart = "Treatments.Start";
    public const string TreatmentsCancel = "Treatments.Cancel";
    public const string TreatmentPlansView = "TreatmentPlans.View";
    public const string TreatmentPlansCreate = "TreatmentPlans.Create";
    public const string TreatmentPlansEdit = "TreatmentPlans.Edit";
    public const string TreatmentPlansPropose = "TreatmentPlans.Propose";
    public const string TreatmentPlansAccept = "TreatmentPlans.Accept";
    public const string TreatmentPlansReject = "TreatmentPlans.Reject";
    public const string TreatmentPlansCancel = "TreatmentPlans.Cancel";
    public const string TreatmentCatalogView = "TreatmentCatalog.View";
    public const string TreatmentCatalogManage = "TreatmentCatalog.Manage";
    public const string PrescriptionsView = "Prescriptions.View";
    public const string PrescriptionsCreate = "Prescriptions.Create";
    public const string PrescriptionsEdit = "Prescriptions.Edit";
    public const string PrescriptionsIssue = "Prescriptions.Issue";
    public const string PrescriptionsCancel = "Prescriptions.Cancel";
    public const string PrescriptionsPrint = "Prescriptions.Print";
    public const string PrescriptionsDownload = "Prescriptions.Download";
    public const string PrescriptionsSend = "Prescriptions.Send";
    public const string CrmView = "CRM.View";
    public const string CrmCreateFollowUp = "CRM.CreateFollowUp";
    public const string CrmEditFollowUp = "CRM.EditFollowUp";
    public const string CrmAssignFollowUp = "CRM.AssignFollowUp";
    public const string CrmCompleteFollowUp = "CRM.CompleteFollowUp";
    public const string CrmCancelFollowUp = "CRM.CancelFollowUp";
    public const string CrmViewActivities = "CRM.ViewActivities";
    public const string CrmCreateActivity = "CRM.CreateActivity";
    public const string FinanceView = "Finance.View";
    public const string FinanceCreatePayment = "Finance.CreatePayment";
    public const string FinanceCreateExpense = "Finance.CreateExpense";
    public const string FinanceManageSalaries = "Finance.ManageSalaries";
    public const string ReportsView = "Reports.View";
    public const string ReportsClinical = "Reports.Clinical";
    public const string ReportsFinancial = "Reports.Financial";
    public const string ReportsCrm = "Reports.CRM";
    public const string ReportsExport = "Reports.Export";
    public const string UsersView = "Users.View";
    public const string UsersCreate = "Users.Create";
    public const string UsersEdit = "Users.Edit";
    public const string UsersActivate = "Users.Activate";
    public const string UsersDeactivate = "Users.Deactivate";
    public const string UsersManageRoles = "Users.ManageRoles";
    public const string SettingsView = "Settings.View";
    public const string SettingsEdit = "Settings.Edit";

    public static IReadOnlySet<string> All { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        PatientsView, PatientsCreate, PatientsEdit, PatientsArchive,
        PatientsViewMedicalHistory, PatientsEditMedicalHistory,
        DoctorsView, DoctorsCreate, DoctorsEdit, DoctorsArchive,
        DoctorsManageSchedule, DoctorsManageCompensation,
        AppointmentsView, AppointmentsCreate, AppointmentsEdit, AppointmentsCancel,
        AppointmentsCheckIn, AppointmentsStart, AppointmentsComplete, AppointmentsMarkNoShow,
        AppointmentsManageSchedule,
        DentalView, DentalCreate, DentalEdit,
        ExaminationView, ExaminationCreate, ExaminationEdit, ExaminationComplete,
        DentalHistoryView, DentalHistoryEdit,
        TreatmentsView, TreatmentsCreate, TreatmentsEdit, TreatmentsApprove, TreatmentsComplete,
        TreatmentsStart, TreatmentsCancel,
        TreatmentPlansView, TreatmentPlansCreate, TreatmentPlansEdit, TreatmentPlansPropose,
        TreatmentPlansAccept, TreatmentPlansReject, TreatmentPlansCancel,
        TreatmentCatalogView, TreatmentCatalogManage,
        PrescriptionsView, PrescriptionsCreate, PrescriptionsEdit, PrescriptionsIssue, PrescriptionsCancel, PrescriptionsPrint,
        PrescriptionsDownload, PrescriptionsSend,
        CrmView, CrmCreateFollowUp, CrmEditFollowUp, CrmAssignFollowUp,
        CrmCompleteFollowUp, CrmCancelFollowUp, CrmViewActivities, CrmCreateActivity,
        FinanceView, FinanceCreatePayment, FinanceCreateExpense, FinanceManageSalaries,
        ReportsView, ReportsClinical, ReportsFinancial, ReportsCrm, ReportsExport,
        UsersView, UsersCreate, UsersEdit, UsersActivate, UsersDeactivate, UsersManageRoles,
        SettingsView, SettingsEdit
    };
}
