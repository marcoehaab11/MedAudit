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
                Permissions.AppointmentsCreate,
                Permissions.AppointmentsEdit,
                Permissions.DentalView,
                Permissions.DentalCreate,
                Permissions.DentalEdit,
                Permissions.TreatmentsView,
                Permissions.TreatmentsCreate,
                Permissions.TreatmentsEdit,
                Permissions.TreatmentsApprove,
                Permissions.TreatmentsComplete,
                Permissions.PrescriptionsView,
                Permissions.PrescriptionsCreate,
                Permissions.PrescriptionsEdit,
                Permissions.PrescriptionsPrint,
                Permissions.PrescriptionsDownload,
                Permissions.PrescriptionsSend
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
                Permissions.AppointmentsManageSchedule
            ]
        };
}
