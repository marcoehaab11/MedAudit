using System.Globalization;
using System.Text.Json.Nodes;

namespace DentalClinic.Domain.Dental;

// Clinical completion history is merged on the server. A browser cannot remove saved steps or supply their author/date.
public static class RootTreatmentFlow
{
    public static readonly string[] CrownKeys = ["crown-preparation", "crown-impression", "crown-temporary", "crown-tryin", "crown-cementation"];
    private static readonly string[] RootKeys = ["access", "length", "obturation", "core", "post"];
    private static readonly string[] CrownDetails = ["type", "material", "shade", "laboratory"];
    private static readonly string[] PostDetails = ["postType", "postCanal", "postSize"];
    private static readonly string[] CrownStepFields = ["dates", "notes"];

    public static JsonObject Save(string? previousJson, string submittedJson, IReadOnlyCollection<EndodonticCanalInput> canals,
        bool crownOnly, Guid examinationId, Guid appointmentId, Guid doctorUserId, DateTimeOffset now, Guid? recordedBy = null)
    {
        canals = canals.Select(c => new EndodonticCanalInput(c.Name?.Trim() ?? "", c.LengthMm,
            string.IsNullOrWhiteSpace(c.Notes) ? null : c.Notes.Trim(),
            string.IsNullOrWhiteSpace(c.FinalFileSize) ? null : c.FinalFileSize.Trim())).ToArray();
        var previous = Parse(previousJson ?? "{}"); var submitted = Parse(submittedJson);
        if (previous["flowVersion"]?.ToString() == "2" && Text(previous, "revision") != Text(submitted, "revision"))
            throw new DentalConcurrencyException("Treatment progress changed in another visit. Reload before saving.");
        if (submittedJson.Length > 64_000) throw new ArgumentException("Treatment progress is too large.");
        var oldProgress = previous["progress"] as JsonObject ?? new JsonObject();
        var incoming = submitted["progress"] as JsonObject ?? new JsonObject();
        var progress = new JsonObject();
        var result = submitted.DeepClone().AsObject(); result["version"] = 1; result["flowVersion"] = 2;
        result["kind"] = "root-canal"; result["crownOnly"] = crownOnly;
        result.Remove("temporaryFillings"); result.Remove("legacyImported");
        var crown = result["crown"] as JsonObject ?? new JsonObject();
        var oldCrown = previous["crown"] as JsonObject;
        var flags = crown["completed"] as JsonArray ?? new JsonArray(false, false, false, false, false);
        if (flags.Count != 5 || flags.Any(v => v is not JsonValue value || !value.TryGetValue<bool>(out _)))
            throw new ArgumentException("Invalid crown steps.");
        var needsPost = !crownOnly && Bool(result, "needsPost"); var needsCrown = crownOnly || Bool(result, "needsCrown");
        if (Done(oldProgress, "post") && !needsPost || CrownKeys.Any(k => Done(oldProgress, k)) && !needsCrown)
            throw new DentalStateException("A performed procedure cannot be removed from the treatment plan.");
        foreach (var key in RootKeys.Concat(CrownKeys))
        {
            if (oldProgress[key] is JsonObject saved && Bool(saved, "completed")) { progress[key] = saved.DeepClone(); continue; }
            var crownIndex = Array.IndexOf(CrownKeys, key);
            var requested = crownIndex >= 0 ? flags[crownIndex]!.GetValue<bool>() && (crownIndex != 2 || Bool(crown, "temporary")) : Done(incoming, key);
            if (!requested) continue;
            if (crownOnly && crownIndex < 0) throw new DentalStateException("A crown-only treatment cannot record root canal steps.");
            if (!crownOnly)
            {
                if (key != "access" && !Done(progress, "access")) throw new DentalStateException("Save access opening first.");
                if (key is not ("access" or "length") && !Done(progress, "length")) throw new DentalStateException("Save working lengths and files first.");
                if (key is not ("access" or "length" or "obturation") && !Done(progress, "obturation")) throw new DentalStateException("Complete obturation first.");
                if ((key == "post" || crownIndex >= 0) && (!Done(progress, "core") || !Bool(result, "decisionsMade")))
                    throw new DentalStateException("Complete the permanent core and choose subsequent procedures first.");
                if (crownIndex >= 0 && needsPost && !Done(progress, "post")) throw new DentalStateException("Complete the planned post before starting the crown.");
            }
            if (key == "access" && canals.Count == 0) throw new ArgumentException("Select at least one canal.");
            if (key is "length" or "obturation" && (canals.Count == 0 || canals.Any(c => c.LengthMm is null or <= 0 or > 50 || string.IsNullOrWhiteSpace(c.FinalFileSize))))
                throw new ArgumentException("Record valid working lengths and final files for all selected canals.");
            if (key == "obturation" && !Bool(result, "obturationDone")) throw new DentalStateException("Confirm obturation is done.");
            if (key == "core" && Text(result, "finalMaterial") is not ("composite" or "amalgam" or "glass-ionomer"))
                throw new DentalStateException("A permanent filling is still required.");
            if (key == "post" && (!needsPost || !Bool(result, "postDone") || Text(result, "postType") is not ("fiber" or "metal" or "custom") ||
                !canals.Any(c => c.Name == Text(result, "postCanal")) || Text(result, "postSize").Length == 0))
                throw new ArgumentException("Record the completed post, its canal, type and size.");
            if (crownIndex >= 0)
            {
                if (!needsCrown) throw new DentalStateException("Choose crown treatment before recording its steps.");
                for (var i = 0; i < crownIndex; i++) if (i != 2 && !Done(progress, CrownKeys[i])) throw new DentalStateException("Save the preceding crown steps first.");
                if (crownIndex == 4 && CrownDetails.Any(k => Text(crown, k).Length == 0))
                    throw new ArgumentException("Complete the crown details before final cementation.");
            }
            var details = crownIndex >= 0 ? crown.DeepClone().AsObject() : key is "access" or "length" or "obturation"
                ? new JsonObject { ["canals"] = CanalJson(canals) }
                : new JsonObject { ["material"] = Text(result, "finalMaterial"), ["postType"] = Text(result, "postType"), ["postCanal"] = Text(result, "postCanal"), ["postSize"] = Text(result, "postSize") };
            progress[key] = new JsonObject
            {
                ["completed"] = true,
                ["completedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
                ["examinationId"] = examinationId.ToString(),
                ["appointmentId"] = appointmentId.ToString(),
                ["doctorUserId"] = doctorUserId.ToString(),
                ["recordedBy"] = (recordedBy ?? doctorUserId).ToString(),
                ["details"] = details
            };
        }
        if (Done(oldProgress, "core") && Text(previous, "finalMaterial") != Text(result, "finalMaterial"))
            throw new DentalStateException("The saved permanent core cannot be replaced by a different material.");
        if (Done(oldProgress, "length") && previous["canals"] is JsonArray oldCanals && !JsonNode.DeepEquals(oldCanals, CanalJson(canals)))
            throw new DentalStateException("Saved canal measurements are part of the clinical history and cannot be overwritten.");
        if (Done(oldProgress, "post") && PostDetails.Any(k => Text(previous, k) != Text(result, k)))
            throw new DentalStateException("The performed post details cannot be overwritten.");
        for (var i = 0; i < 5; i++) flags[i] = Done(progress, CrownKeys[i]) || i == 2 && flags[i]?.GetValue<bool>() == true;
        foreach (var field in CrownStepFields)
        {
            var values = crown[field] as JsonArray ?? new JsonArray("", "", "", "", "");
            if (values.Count != 5) throw new ArgumentException("Invalid crown step dates or notes.");
            for (var i = 0; i < 5; i++) if (Done(oldProgress, CrownKeys[i]) && oldCrown?[field] is JsonArray saved && saved.Count == 5) values[i] = saved[i]?.DeepClone();
            crown[field] = values;
        }
        crown["completed"] = flags; crown["step"] = FirstCrownStep(progress, flags); result["crown"] = crown;
        result["progress"] = progress; result["canals"] = CanalJson(canals);
        result["obturationDone"] = Done(progress, "obturation") || Bool(result, "obturationDone");
        result["postDone"] = Done(progress, "post") || Bool(result, "postDone");
        result["needsPost"] = needsPost; result["needsCrown"] = needsCrown;
        if (Bool(previous, "decisionsMade")) result["decisionsMade"] = true;
        var temporary = previous["temporaryFillings"]?.DeepClone().AsArray() ?? new JsonArray();
        if (Bool(result, "temporaryRequested"))
        {
            if (!Done(progress, "obturation") || Done(progress, "core") || Text(result, "finalMaterial") != "temporary")
                throw new DentalStateException("Temporary filling is available after obturation and before the permanent core.");
            if (!temporary.Any(t => Text(t!, "examinationId") == examinationId.ToString()))
                temporary.Add(new JsonObject
                {
                    ["examinationId"] = examinationId.ToString(),
                    ["appointmentId"] = appointmentId.ToString(),
                    ["completedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
                    ["doctorUserId"] = doctorUserId.ToString(),
                    ["recordedBy"] = (recordedBy ?? doctorUserId).ToString()
                });
        }
        result["temporaryFillings"] = temporary; result["temporaryRequested"] = false;
        result["stage"] = NextStage(result); result["revision"] = Guid.NewGuid().ToString();
        if (result.ToJsonString().Length > 64_000) throw new ArgumentException("The treatment history is too large.");
        return result;
    }

    public static int NextStage(JsonObject state)
    {
        var p = state["progress"] as JsonObject ?? new JsonObject();
        if (!Bool(state, "crownOnly"))
        {
            if (!Done(p, "access")) return 1;
            if (!Done(p, "length")) return 2;
            if (!Done(p, "obturation")) return 4;
            if (!Done(p, "core")) return 5;
            if (!Bool(state, "decisionsMade")) return 9;
            if (Bool(state, "needsPost") && !Done(p, "post")) return 7;
        }
        return (Bool(state, "crownOnly") || Bool(state, "needsCrown")) && !Done(p, "crown-cementation") ? 8 : 6;
    }
    public static JsonObject ImportLegacy(EndodonticRecord record, Guid appointmentId)
    {
        var state = Parse(record.WorkflowJson ?? "{}"); var p = new JsonObject();
        var stage = (int?)record.Stage ?? 1;
        void Import(string key) => p[key] = new JsonObject
        {
            ["completed"] = true,
            ["legacyImported"] = true,
            ["recordedAt"] = record.UpdatedAt.ToString("O", CultureInfo.InvariantCulture),
            ["examinationId"] = record.ExaminationId.ToString(),
            ["appointmentId"] = appointmentId.ToString(),
            ["doctorUserId"] = record.CreatedBy.ToString()
        };
        var crownOnly = record.RestorationType == "crown-only";
        if (!crownOnly)
        {
            if (stage is >= 2 and <= 8) Import("access");
            if (stage is >= 3 and <= 8) Import("length");
            if (stage is 5 or 6 or 8) Import("obturation");
            if (stage is 6 or 8 && state["finalMaterial"]?.ToString() is "composite" or "amalgam" or "glass-ionomer") Import("core");
        }
        if (state["crown"]?["completed"] is JsonArray flags)
            for (var i = 0; i < Math.Min(5, flags.Count); i++) if (flags[i]?.ToString() == "true" && i != 2) Import(CrownKeys[i]);
        state["progress"] = p; state["crownOnly"] = crownOnly; state["decisionsMade"] = stage is 6 or 8;
        state["canals"] = CanalJson(record.Canals.Select(c => new EndodonticCanalInput(c.Name, c.LengthMm, c.Notes, c.FinalFileSize)));
        state["postType"] = record.PostType; state["postCanal"] = record.PostCanal;
        return state;
    }
    public static bool Done(JsonObject progress, string key) => progress[key] is JsonObject step && Bool(step, "completed");
    public static JsonObject Parse(string json)
    {
        try { return JsonNode.Parse(json, documentOptions: new() { MaxDepth = 32 }) as JsonObject ?? throw new ArgumentException("Invalid treatment flow."); }
        catch (System.Text.Json.JsonException e) { throw new ArgumentException("Invalid treatment flow.", e); }
    }
    private static JsonArray CanalJson(IEnumerable<EndodonticCanalInput> canals) => new(canals.OrderBy(c => c.Name, StringComparer.Ordinal).Select(c => (JsonNode)new JsonObject
    { ["name"] = c.Name, ["lengthMm"] = c.LengthMm, ["finalFileSize"] = c.FinalFileSize, ["notes"] = c.Notes }).ToArray());
    private static int FirstCrownStep(JsonObject progress, JsonArray flags)
    { for (var i = 0; i < 5; i++) if (!Done(progress, CrownKeys[i]) && (i != 2 || flags[i]?.GetValue<bool>() != true)) return i + 1; return 5; }
    private static bool Bool(JsonObject data, string key) => data[key] is JsonValue value && value.TryGetValue<bool>(out var result) && result;
    private static string Text(JsonNode data, string key) => data[key]?.ToString() ?? "";
}
