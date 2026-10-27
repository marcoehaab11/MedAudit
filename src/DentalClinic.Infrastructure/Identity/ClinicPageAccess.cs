namespace DentalClinic.Infrastructure.Identity;

public static class ClinicPageAccess
{
    private static readonly Dictionary<string, string> Pages = new(StringComparer.OrdinalIgnoreCase)
    {
        [""] = "", ["dashboard"] = "", ["guide"] = "", ["access-denied"] = "",
        ["treatments/catalog"] = "TreatmentCatalog.View", ["medications"] = "Prescriptions.View",
        ["users"] = "Users.View",
        ["users/:id"] = "Users.View",
        ["branches"] = "Settings.View",
        ["patients"] = "Patients.View",
        ["patients/:id"] = "Patients.View",
        ["patients/create"] = "Patients.Create",
        ["patients/:id/edit"] = "Patients.Edit",
        ["patients/:id/dental"] = "Dental.View",
        ["patients/:id/implants/:tooth"] = "Dental.View",
        ["doctors"] = "Doctors.View",
        ["doctors/:id"] = "Doctors.View",
        ["doctors/create"] = "Doctors.Create",
        ["doctors/:id/edit"] = "Doctors.Edit",
        ["appointments"] = "Appointments.View",
        ["appointments/create"] = "Appointments.Create",
        ["appointments/:appointmentId/examination"] = "Examination.View",
        ["appointments/:appointmentId/visit"] = "Examination.View",
        ["treatment-plans"] = "TreatmentPlans.View",
        ["treatment-plans/:id"] = "TreatmentPlans.View",
        ["treatment-plans/create"] = "TreatmentPlans.Create",
        ["treatment-plans/:id/edit"] = "TreatmentPlans.Edit",
        ["treatments"] = "Treatments.View",
        ["treatments/:id"] = "Treatments.View",
        ["treatment-catalog"] = "TreatmentCatalog.View",
        ["medications-catalog"] = "Prescriptions.View",
        ["prescriptions"] = "Prescriptions.View",
        ["prescriptions/:id"] = "Prescriptions.View",
        ["prescriptions/create"] = "Prescriptions.Create",
        ["prescriptions/:id/edit"] = "Prescriptions.Edit",
        ["crm"] = "CRM.View",
        ["crm/follow-ups"] = "CRM.View",
        ["crm/follow-ups/:id"] = "CRM.View",
        ["crm/follow-ups/create"] = "CRM.CreateFollowUp",
        ["finance/my-dues"] = "Finance.View",
        ["finance"] = "Finance.View",
        ["finance/revenue"] = "Finance.Revenue.View",
        ["finance/payments"] = "Finance.Payments.View",
        ["finance/payments/create"] = "Finance.Payments.Create",
        ["finance/expenses"] = "Finance.Expenses.View",
        ["finance/expenses/create"] = "Finance.Expenses.Create",
        ["finance/categories"] = "Finance.Categories.View",
        ["lab"] = "Lab.View",
        ["insurance"] = "Insurance.View",
        ["reports"] = "Reports.View",
        ["reports/financial"] = "Reports.Financial",
        ["reports/revenue"] = "Reports.Financial",
        ["reports/expenses"] = "Reports.Financial",
        ["reports/profit"] = "Reports.Financial",
        ["reports/patients"] = "Reports.Patients",
        ["reports/appointments"] = "Reports.Appointments",
        ["reports/doctors"] = "Reports.Doctors",
        ["reports/treatments"] = "Reports.Treatments",
        ["reports/prescriptions"] = "Reports.Prescriptions",
        ["reports/crm"] = "Reports.CRM",
        ["notifications"] = "Notifications.View",
        ["inventory"] = "Inventory.View",
        ["online-booking"] = "Settings.PublicBooking",
        ["settings"] = "Settings.View",
        ["backup"] = "Backup.Create",
    };

    // null denies unknown pages; an empty permission still requires a verified session.
    public static string? RequiredPermission(string uri)
    {
        if (!uri.StartsWith('/') || uri.StartsWith("//", StringComparison.Ordinal)) return null;
        var path = uri.Split('?', 2)[0].Trim('/');
        var segments = path.Split('/');
        foreach (var (pattern, permission) in Pages)
        {
            var expected = pattern.Split('/');
            if (expected.Length != segments.Length) continue;
            var matches = true;
            for (var i = 0; i < expected.Length; i++)
                if (expected[i] == ":tooth" ? !int.TryParse(segments[i], out var tooth) || !DentalClinic.Domain.Dental.PermanentToothCatalog.IsValid(tooth) : expected[i].StartsWith(':') ? !Guid.TryParse(segments[i], out _) : !expected[i].Equals(segments[i], StringComparison.OrdinalIgnoreCase))
                { matches = false; break; }
            if (matches) return permission;
        }
        return null;
    }
}
