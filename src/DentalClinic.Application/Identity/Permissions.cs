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
    public const string AppointmentsManageSchedule = "Appointments.ManageSchedule";
    public const string DentalView = "Dental.View";
    public const string DentalCreate = "Dental.Create";
    public const string DentalEdit = "Dental.Edit";
    public const string TreatmentsView = "Treatments.View";
    public const string TreatmentsCreate = "Treatments.Create";
    public const string TreatmentsEdit = "Treatments.Edit";
    public const string TreatmentsApprove = "Treatments.Approve";
    public const string TreatmentsComplete = "Treatments.Complete";
    public const string PrescriptionsView = "Prescriptions.View";
    public const string PrescriptionsCreate = "Prescriptions.Create";
    public const string PrescriptionsEdit = "Prescriptions.Edit";
    public const string PrescriptionsPrint = "Prescriptions.Print";
    public const string PrescriptionsDownload = "Prescriptions.Download";
    public const string PrescriptionsSend = "Prescriptions.Send";
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
        AppointmentsView, AppointmentsCreate, AppointmentsEdit, AppointmentsCancel, AppointmentsManageSchedule,
        DentalView, DentalCreate, DentalEdit,
        TreatmentsView, TreatmentsCreate, TreatmentsEdit, TreatmentsApprove, TreatmentsComplete,
        PrescriptionsView, PrescriptionsCreate, PrescriptionsEdit, PrescriptionsPrint,
        PrescriptionsDownload, PrescriptionsSend,
        FinanceView, FinanceCreatePayment, FinanceCreateExpense, FinanceManageSalaries,
        ReportsView, ReportsClinical, ReportsFinancial, ReportsCrm, ReportsExport,
        UsersView, UsersCreate, UsersEdit, UsersActivate, UsersDeactivate, UsersManageRoles,
        SettingsView, SettingsEdit
    };
}
