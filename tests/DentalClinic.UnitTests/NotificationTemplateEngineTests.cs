using DentalClinic.Application.Notifications;
using Xunit;

namespace DentalClinic.UnitTests;

public class NotificationTemplateEngineTests
{
    [Fact]
    public void RenderReplacesSupportedVariablesCorrectly()
    {
        var template = "Hello {{PatientName}}, your appointment with Dr. {{DoctorName}} at {{ClinicName}} is scheduled for {{AppointmentDate}} at {{AppointmentTime}}.";
        var vars = new Dictionary<string, string>
        {
            ["PatientName"] = "Nour Mahmoud",
            ["DoctorName"] = "Ahmed Tarek",
            ["ClinicName"] = "Smile Care Clinic",
            ["AppointmentDate"] = "2026-08-17",
            ["AppointmentTime"] = "10:30 AM"
        };

        var result = NotificationTemplateEngine.Render(template, vars);

        Assert.Equal("Hello Nour Mahmoud, your appointment with Dr. Ahmed Tarek at Smile Care Clinic is scheduled for 2026-08-17 at 10:30 AM.", result);
    }

    [Fact]
    public void RenderLeavesUnsupportedVariablesUnchangedWithoutExecutingCode()
    {
        var template = "System notification: {{ArbitraryCode}} and {{SystemVariable}}.";
        var vars = new Dictionary<string, string>
        {
            ["ArbitraryCode"] = "EXECUTE_MALICIOUS_SCRIPT",
            ["SystemVariable"] = "SAFE_VAL"
        };

        var result = NotificationTemplateEngine.Render(template, vars);

        Assert.Equal("System notification: {{ArbitraryCode}} and {{SystemVariable}}.", result);
    }
}
