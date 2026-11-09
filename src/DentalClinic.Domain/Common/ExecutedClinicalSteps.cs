using System.Globalization;
using System.Text.Json.Nodes;

namespace DentalClinic.Domain.Common;

// Server-owned, append-only execution metadata. Never copied from submitted workflow JSON.
public static class ExecutedClinicalSteps
{
    public static bool Contains(string existing,string key) => JsonNode.Parse(existing)!.AsArray().Any(e => e?["key"]?.ToString()==key);
    public static string Append(string existing, string key, string step, DateTimeOffset now, Guid? appointmentId = null, string? reportedDate = null)
    {
        var events = JsonNode.Parse(existing)!.AsArray();
        if (events.Any(e => e?["key"]?.ToString() == key)) return existing;
        if (events.Count >= 2000) throw new ArgumentException("The clinical execution history has reached its supported size.");
        events.Add(new JsonObject { ["key"] = key, ["step"] = step, ["performedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
            ["appointmentId"] = appointmentId?.ToString(), ["reportedDate"] = reportedDate });
        return events.ToJsonString();
    }
}
