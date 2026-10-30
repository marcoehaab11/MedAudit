using System.Globalization;
using System.Text.Json.Nodes;

namespace DentalClinic.Domain.Treatments;

// Counts and clinical visit identity are generated on the server, never accepted from browser counters.
public static class ClinicalWorkflow
{
    public static string Save(string? existing, string kind, string planJson, Guid visitId, Guid appointmentId,
        Guid doctorProfileId, Guid doctorUserId, DateOnly visitDate, string visitJson, bool performed, DateTimeOffset now)
    {
        if (kind is not ("scaling" or "bleaching")) throw new ArgumentException("Unknown clinical workflow.");
        if (visitId == Guid.Empty || appointmentId == Guid.Empty || doctorProfileId == Guid.Empty || doctorUserId == Guid.Empty)
            throw new ArgumentException("A verified visit and doctor are required.");
        var root = existing is null ? new JsonObject { ["schemaVersion"] = 1, ["kind"] = kind, ["visits"] = new JsonArray() } : Parse(existing);
        if (Text(root, "kind") != kind) throw new ArgumentException("The treatment workflow cannot be changed.");
        var plan = Parse(planJson); var data = Parse(visitJson); var visits = root["visits"]!.AsArray();
        if (planJson.Length > 30_000 || visitJson.Length > 100_000 || visits.Count >= 200 && !visits.Any(x => Text(x!, "id") == visitId.ToString()))
            throw new ArgumentException("The clinical record exceeds its supported size.");
        var old = visits.FirstOrDefault(x => Text(x!, "id") == visitId.ToString())?.AsObject();
        if (old is not null && (Text(old, "appointmentId") != appointmentId.ToString() || Text(old, "doctorProfileId") != doctorProfileId.ToString()))
            throw new ArgumentException("An existing session cannot be moved to a different visit or doctor.");
        if (visits.Any(x => Text(x!, "appointmentId") == appointmentId.ToString() && Text(x!, "id") != visitId.ToString()))
            throw new ArgumentException("Continue the existing session for this visit instead of recording it twice.");
        var alreadyPerformed = old?["performed"]?.GetValue<bool>() == true;
        if (alreadyPerformed && !performed) throw new ArgumentException("A performed session cannot be changed into a draft.");
        var completed = CompletedCount(root) + (performed && !alreadyPerformed ? 1 : 0);
        var baselineLocked = root["baselineLocked"]?.GetValue<bool>() == true || visits.Any(v =>
            v?["performed"]?.GetValue<bool>() == true || v?["correctedAt"] is not null ||
            v?["revisions"] is JsonArray history && history.Any(r => r?["performed"]?.GetValue<bool>() == true));
        ValidatePlan(plan, baselineLocked ? root["plan"] as JsonObject : null, kind, completed);
        ValidateInstructions(data);
        if (performed) ValidateVisit(plan, data, kind);
        var visit = new JsonObject
        {
            ["id"] = visitId.ToString(),
            ["appointmentId"] = appointmentId.ToString(),
            ["doctorProfileId"] = doctorProfileId.ToString(),
            ["doctorUserId"] = doctorUserId.ToString(),
            ["date"] = visitDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["performed"] = performed,
            ["savedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
            ["data"] = data
        };
        var approvals = old?["instructionApprovals"]?.DeepClone().AsArray() ?? new JsonArray();
        var previousInstructions = old?["data"] as JsonObject;
        if (Text(data, "instructionsStatus") == "manual-handoff" && (previousInstructions is null ||
            Text(previousInstructions, "instructionsStatus") != "manual-handoff" ||
            Text(previousInstructions, "instructionsText") != Text(data, "instructionsText") ||
            Text(previousInstructions, "instructionsLanguage") != Text(data, "instructionsLanguage")))
            approvals.Add(new JsonObject
            {
                ["text"] = Text(data, "instructionsText"),
                ["language"] = Text(data, "instructionsLanguage"),
                ["status"] = "manual-handoff-prepared",
                ["preparedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
                ["preparedBy"] = doctorUserId.ToString()
            });
        if (approvals.Count > 0) visit["instructionApprovals"] = approvals;
        if (old is not null)
        {
            var revisions = old["revisions"]?.DeepClone().AsArray() ?? new JsonArray();
            if (revisions.Count >= 100) throw new ArgumentException("This session has reached its revision limit.");
            var revision = new JsonObject { ["savedAt"] = old["savedAt"]?.DeepClone(), ["data"] = old["data"]?.DeepClone(), ["performed"] = old["performed"]?.DeepClone() };
            foreach (var key in "correctionReason|correctedBy|correctedAt".Split('|'))
                if (old[key] is not null) { revision[key] = old[key]!.DeepClone(); if (!performed) visit[key] = old[key]!.DeepClone(); }
            revisions.Add(revision);
            visit["revisions"] = revisions; visits[visits.IndexOf(old)] = visit;
        }
        else visits.Add(visit);
        root["plan"] = plan;
        if (kind == "bleaching" && (baselineLocked || performed)) root["baselineLocked"] = true;
        var result = root.ToJsonString();
        if (result.Length > 1_000_000) throw new ArgumentException("The clinical record is too large.");
        return result;
    }

    public static void EnsureComplete(string json)
    {
        var root = Parse(json); var kind = Text(root, "kind"); var plan = root["plan"]!.AsObject();
        var completed = CompletedCount(root);
        ValidatePlan(plan, plan, kind, completed);
        if (kind == "bleaching" && (completed == 0 || completed != Integer(plan, "plannedSessions", 1, 200)))
            throw new TreatmentStateException("Complete and save all planned bleaching sessions first.");
        if (completed == 0) throw new TreatmentStateException("Record a performed clinical session first.");
        foreach (var visit in root["visits"]!.AsArray().Where(x => x!["performed"]?.GetValue<bool>() == true))
        {
            ValidateVisit(plan, visit!["data"]!.AsObject(), kind, false);
            ValidateInstructions(visit["data"]!.AsObject());
        }
    }

    public static int CompletedCount(JsonObject root) => root["visits"]!.AsArray().Count(x => x!["performed"]?.GetValue<bool>() == true);
    public static string Retract(string json, Guid sessionId, Guid actor, string reason, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length is < 5 or > 1000) throw new ArgumentException("Record a correction reason between 5 and 1000 characters.");
        var root = Parse(json); var visit = root["visits"]!.AsArray().FirstOrDefault(v => Text(v!, "id") == sessionId.ToString())?.AsObject()
            ?? throw new ArgumentException("Session not found.");
        if (visit["performed"]?.GetValue<bool>() != true) throw new ArgumentException("The session is not currently marked performed.");
        visit["performed"] = false; visit["correctionReason"] = reason.Trim(); visit["correctedBy"] = actor.ToString(); visit["correctedAt"] = now.ToString("O", CultureInfo.InvariantCulture);
        return root.ToJsonString();
    }
    private static JsonObject Parse(string json)
    {
        try { return JsonNode.Parse(json, documentOptions: new() { MaxDepth = 24 }) as JsonObject ?? throw new ArgumentException("Clinical data must be an object."); }
        catch (System.Text.Json.JsonException) { throw new ArgumentException("Invalid clinical data."); }
    }
    private static void ValidatePlan(JsonObject plan, JsonObject? previous, string kind, int completed)
    {
        if (kind == "bleaching")
        {
            var planned = Integer(plan, "plannedSessions", 1, 200);
            if (completed > planned) throw new TreatmentStateException("Increase planned sessions before recording another performed session.");
            Choice(plan, "baselineShade", "A1|A2|A3|A3.5|A4|B1|B2|B3|B4|C1|C2|C3|C4|D2|D3|D4", completed > 0);
            Choice(plan, "treatmentType", "in-office|at-home|combined", completed > 0);
            if (previous is not null && Text(previous, "baselineShade").Length > 0 && Text(previous, "baselineShade") != Text(plan, "baselineShade"))
                throw new TreatmentStateException("Keep the original baseline shade for comparison throughout this treatment.");
        }
    }
    private static void ValidateVisit(JsonObject plan, JsonObject data, string kind, bool checkConfiguredProduct = true)
    {
        if (kind == "bleaching")
        {
            Required(data, "brand"); Required(data, "concentration"); Integer(data, "durationMinutes", 1, 480);
            if (checkConfiguredProduct && plan["products"] is JsonArray products && !products.Any(p => p is JsonObject product && Text(product, "name") == Text(data, "brand") && product["concentrations"] is JsonArray values && values.Any(v => v?.ToString() == Text(data, "concentration"))))
                throw new ArgumentException("Choose a concentration configured for the selected product.");
            Choice(data, "shadeAfter", "A1|A2|A3|A3.5|A4|B1|B2|B3|B4|C1|C2|C3|C4|D2|D3|D4");
            Choice(data, "sensitivity", "none|mild|moderate|severe");
        }
        else
        {
            Choice(data, "scope", "full|upper|lower|quadrants");
            if (Text(data, "scope") == "quadrants" && (data["quadrants"] is not JsonArray quadrants || quadrants.Count == 0 || quadrants.Any(q => !"UR|UL|LR|LL".Split('|').Contains(q?.ToString(), StringComparer.Ordinal))))
                throw new ArgumentException("Choose at least one valid quadrant.");
            Choice(data, "calculus", "mild|moderate|heavy"); Choice(data, "gingivalStatus", "healthy|mild|moderate|suspected-periodontitis");
            if (data["scalingPerformed"]?.GetValue<bool>() != true) throw new TreatmentStateException("Save unfinished scaling as a draft.");
            Choice(data, "pocketMapping", "yes|no"); Choice(data, "polishing", "yes|no|not-indicated");
            if (Text(data, "polishing") == "yes") Choice(data, "polishingMaterial", "paste|air|other");
            Choice(data, "sensitivity", "none|mild|moderate|severe");
            if (Text(data, "pocketMapping") == "yes") ValidatePockets(data);
        }
    }
    private static void ValidateInstructions(JsonObject data)
    {
        if (Text(data, "instructionsText").Length > 4000) throw new ArgumentException("Patient instructions are too long.");
        if (Text(data, "instructionsStatus").Length > 0) Choice(data, "instructionsStatus", "draft|manual-handoff");
        if (Text(data, "instructionsLanguage").Length > 0) Choice(data, "instructionsLanguage", "ar|en");
        if (Text(data, "instructionsStatus") == "manual-handoff")
        {
            Required(data, "instructionsText"); Choice(data, "instructionsLanguage", "ar|en");
        }
    }
    private static void ValidatePockets(JsonObject data)
    {
        if (data["pockets"] is not JsonArray pockets || pockets.Count == 0 || pockets.Count > 52) throw new ArgumentException("Save the measured teeth first.");
        var teeth = new HashSet<int>();
        foreach (var pocket in pockets)
        {
            if (pocket is not JsonObject item) throw new ArgumentException("Invalid pocket record.");
            var tooth = Integer(item, "tooth", 11, 85); var quadrant = tooth / 10; var position = tooth % 10;
            if (position < 1 || position > (quadrant >= 5 ? 5 : 8) || quadrant is < 1 or > 8 || !teeth.Add(tooth)) throw new ArgumentException("Choose a valid, unique permanent or primary tooth.");
            var measured = false;
            foreach (var site in "MB|B|DB|ML|L|DL".Split('|'))
            {
                if (item[site] is null || item[site]!.ToString().Length == 0) continue;
                if (!decimal.TryParse(item[site]!.ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var mm) || mm <= 0 || mm > 20)
                    throw new ArgumentException("Pocket measurements must be greater than zero and at most 20 mm; unmeasured sites stay blank.");
                measured = true;
            }
            if (!measured) throw new ArgumentException("Record at least one measured site for each mapped tooth.");
            if (Text(item, "treatment").Length > 0)
            {
                Choice(item, "treatment", "srp|chlorhexidine|local-antimicrobial|systemic-antibiotics|referral|other");
                Choice(item, "treatmentStatus", "planned|performed");
            }
            Choice(item, "bleeding", "yes|no", false);
            foreach (var field in "mobility|furcation".Split('|')) if (Text(item, field).Length > 0) Integer(item, field, 0, 3);
            if (Text(item, "recession").Length > 0 && (!decimal.TryParse(Text(item, "recession"), NumberStyles.Number, CultureInfo.InvariantCulture, out var recession) || recession < 0 || recession > 20)) throw new ArgumentException("Enter a valid recession measurement between 0 and 20 mm.");
        }
    }
    private static string Text(JsonNode data, string field) => data[field]?.ToString().Trim() ?? "";
    private static void Required(JsonObject data, string field) { if (Text(data, field).Length is 0 or > 4000) throw new ArgumentException($"Complete the {field} field."); }
    private static int Integer(JsonObject data, string field, int min, int max)
    { if (!int.TryParse(Text(data, field), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) || value < min || value > max) throw new ArgumentException($"Enter a valid {field} between {min} and {max}."); return value; }
    private static void Choice(JsonObject data, string field, string values, bool required = true)
    { if ((!required && Text(data, field).Length == 0)) return; if (!values.Split('|').Contains(Text(data, field), StringComparer.Ordinal)) throw new ArgumentException($"Choose a valid {field}."); }
}
