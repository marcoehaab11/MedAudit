using System.Text.RegularExpressions;

namespace DentalClinic.Application.Notifications;

public static partial class NotificationTemplateEngine
{
    private static readonly HashSet<string> SupportedVariables = new(StringComparer.OrdinalIgnoreCase)
    {
        "ClinicName",
        "PatientName",
        "DoctorName",
        "AppointmentDate",
        "AppointmentTime",
        "BookingReference",
        "PrescriptionNumber",
        "TreatmentName"
    };

    public static string Render(string templateText, IReadOnlyDictionary<string, string>? variables)
    {
        if (string.IsNullOrWhiteSpace(templateText)) return string.Empty;
        if (variables == null || variables.Count == 0) return templateText;

        return VariableRegex().Replace(templateText, match =>
        {
            var varName = match.Groups[1].Value.Trim();
            if (SupportedVariables.Contains(varName) && variables.TryGetValue(varName, out var val))
            {
                return val ?? string.Empty;
            }
            return match.Value; // Leave unsupported or unmapped variables unchanged safely
        });
    }

    [GeneratedRegex(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled)]
    private static partial Regex VariableRegex();
}
