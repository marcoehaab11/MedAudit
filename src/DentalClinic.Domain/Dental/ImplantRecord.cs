using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Dental;

public sealed class ImplantRecord : TenantOwnedEntity
{
    private ImplantRecord() { }
    public ImplantRecord(Guid tenantId, Guid patientId, int toothNumber, Guid doctorProfileId, Guid? treatmentId, DateTimeOffset now)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty) throw new ArgumentException("Patient, clinic and doctor are required.");
        PermanentToothCatalog.Get(toothNumber);
        TenantId = tenantId; PatientId = patientId; ToothNumber = toothNumber; DoctorProfileId = doctorProfileId;
        TreatmentId = treatmentId; CreatedAt = UpdatedAt = now; Version = Guid.NewGuid();
    }
    public Guid PatientId { get; private set; }
    public int ToothNumber { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public Guid? TreatmentId { get; private set; }
    public string WorkflowJson { get; private set; } = "{}";
    public string ExecutedStepsJson { get; private set; } = "[]";
    public string AppointmentLinksJson { get; private set; } = "{}";
    public int CompletedStep { get; private set; }
    public Guid Version { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Save(string json, int? completeStep, Guid expectedVersion, DateTimeOffset now,
        string? confirmedVisitId = null, int? confirmedVisitStage = null, Guid? appointmentId = null)
    {
        if (Version != expectedVersion) throw new DentalConcurrencyException("The implant record changed. Reload before saving.");
        if (json.Length > 200_000) throw new ArgumentException("Implant notes are too large. Upload photographs separately.");
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("schemaVersion", out var schema) || schema.ValueKind != JsonValueKind.Number || !schema.TryGetInt32(out var schemaVersion) || schemaVersion != 1)
            throw new ArgumentException("Unsupported implant record format.");
        ValidateShape(root);
        if (completeStep is < 1 or > 7 || completeStep > CompletedStep + 1) throw new ArgumentException("Complete the preceding implant stage first.");
        var target = Math.Max(CompletedStep, completeStep ?? 0);
        using var previous = JsonDocument.Parse(WorkflowJson);
        foreach (var saved in JsonNode.Parse(ExecutedStepsJson)!.AsArray().Where(e => e?["step"]?.ToString() is "implant-healing" or "implant-followup"))
        {
            var stage = saved!["step"]!.ToString() == "implant-healing" ? 3 : 7;
            var id = saved["key"]!.ToString()["visit:".Length..];
            if (!root.TryGetProperty(stage == 3 ? "healingVisits" : "followupVisits", out var visits))
                throw new ArgumentException("Keep the previously performed implant visits.");
            var kept = visits.EnumerateArray().SingleOrDefault(v => Text(v,"id") == id);
            if (kept.ValueKind != JsonValueKind.Object) throw new ArgumentException("Keep the previously performed implant visits.");
            ValidateVisit(kept,stage);
        }
        for (var stage = 1; stage <= target; stage++)
        {
            if (stage is 3 or 7 && CompletedStep >= stage && completeStep != stage)
                ValidateSavedVisits(previous.RootElement, root, stage);
            else ValidateStage(root, stage);
        }
        var history = ExecutedStepsJson;
        if (completeStep.HasValue && completeStep > CompletedStep && completeStep is not (3 or 7))
            history = ExecutedClinicalSteps.Append(history, $"stage:{completeStep}", $"implant-{completeStep}", now, appointmentId,
                completeStep == 1 ? null : Text(root.GetProperty(completeStep switch { 2 => "placement", 4 => "abutment", 5 => "scan", _ => "fixation" }), "date"));
        if (confirmedVisitId is not null)
        {
            if (confirmedVisitStage is not (3 or 7) || target < (confirmedVisitStage == 3 ? 2 : 6))
                throw new ArgumentException("Complete the preceding implant stages before recording this visit.");
            var visits = root.GetProperty(confirmedVisitStage == 3 ? "healingVisits" : "followupVisits");
            var visit = visits.EnumerateArray().SingleOrDefault(v => Text(v, "id") == confirmedVisitId);
            if (visit.ValueKind != JsonValueKind.Object) throw new ArgumentException("Choose the saved follow-up visit.");
            ValidateVisit(visit, confirmedVisitStage.Value);
            history = ExecutedClinicalSteps.Append(history, $"visit:{confirmedVisitId}", confirmedVisitStage == 3 ? "implant-healing" : "implant-followup", now, appointmentId, Text(visit, "date"));
        }
        else if (completeStep is 3 or 7)
            foreach (var visit in root.GetProperty(completeStep == 3 ? "healingVisits" : "followupVisits").EnumerateArray())
                history = ExecutedClinicalSteps.Append(history, $"visit:{Text(visit, "id")}", completeStep == 3 ? "implant-healing" : "implant-followup", now, appointmentId, Text(visit, "date"));
        ExecutedStepsJson = history;
        WorkflowJson = root.GetRawText(); CompletedStep = target; UpdatedAt = now; Version = Guid.NewGuid();
    }

    public void SetAppointmentLinks(string json) => AppointmentLinksJson = json;

    private static void ValidateSavedVisits(JsonElement previous, JsonElement current, int stage)
    {
        var key = stage == 3 ? "healingVisits" : "followupVisits";
        if (!current.TryGetProperty(key, out var visits)) throw new ArgumentException("Keep the previously recorded follow-up visits.");
        foreach (var old in previous.GetProperty(key).EnumerateArray())
        {
            // A newly added visit may remain a draft; an already complete visit cannot be erased or emptied.
            try { ValidateVisit(old, stage); } catch (ArgumentException) { continue; }
            var match = visits.EnumerateArray().FirstOrDefault(x => Text(x, "id") == Text(old, "id"));
            if (match.ValueKind == JsonValueKind.Undefined) throw new ArgumentException("Keep the previously recorded follow-up visits.");
            ValidateVisit(match, stage);
        }
        if (stage == 3 && !visits.EnumerateArray().Any(x => Text(x, "nextPlan") == "prosthetic"))
            throw new ArgumentException("Keep the clinical decision to proceed to prosthetic restoration.");
    }

    public static void ValidateStage(JsonElement root, int stage)
    {
        var key = stage switch { 1 => "planning", 2 => "placement", 3 => "healingVisits", 4 => "abutment", 5 => "scan", 6 => "fixation", _ => "followupVisits" };
        if (!root.TryGetProperty(key, out var data)) throw new ArgumentException($"The {key} stage is required.");
        if (stage is 3 or 7)
        {
            if (data.ValueKind != JsonValueKind.Array || data.GetArrayLength() == 0 || data.GetArrayLength() > 100) throw new ArgumentException("Record a follow-up visit first.");
            foreach (var visit in data.EnumerateArray()) ValidateVisit(visit, stage);
            if (stage == 3 && Text(data[data.GetArrayLength() - 1], "nextPlan") != "prosthetic") throw new ArgumentException("Record the decision to proceed to prosthetic restoration first.");
            return;
        }
        var fields = stage switch
        {
            1 => new[] { "imaging", "timing", "graft" },
            2 => ["date", "brand", "system", "connection", "diameter", "length", "placementType", "stability", "component"],
            4 => ["date", "type", "brand", "connection", "height", "angle"],
            5 => ["date", "scanType", "coping", "crownType", "shadeSystem", "shade", "delivery"],
            _ => ["date", "retention", "seating", "occlusion", "stability"]
        };
        foreach (var field in fields) Require(data, field);
        ValidateChoices(data, stage);
        if (stage != 1) Date(data, "date");
        if (stage == 2)
        {
            Number(data, "diameter", 1, 10); Number(data, "length", 3, 30);
            OptionalNumber(data, "torque", 0, 150); OptionalNumber(data, "isq", 0, 100);
            if (data.TryGetProperty("graftEnabled", out var enabled) && enabled.ValueKind == JsonValueKind.True)
            { Require(data, "graftMaterial"); Require(data, "graftType"); Number(data, "graftQuantity", 0.01m, 1000); Require(data, "graftUnit"); }
        }
        if (stage == 4) { Number(data, "height", 0.1m, 20); Number(data, "angle", 0, 90); }
        if (stage == 5 && Text(data, "delivery") == "lab") Require(data, "laboratory");
        if (stage == 6)
        {
            if (Text(data, "seating") != "final") throw new ArgumentException("Save try-in or temporary crowns as drafts; final seating is required to continue.");
            if (Text(data, "retention") == "cement") Require(data, "cement");
        }
    }

    public static void ValidateVisit(JsonElement visit, int stage)
    {
        if (!Guid.TryParse(Text(visit, "id"), out var id) || id == Guid.Empty) throw new ArgumentException("Each follow-up visit needs a unique identifier.");
        Date(visit, "date");
        var fields = stage == 3 ? new[] { "healingType", "status", "softTissue", "mobility", "pain", "boneLevel", "nextPlan", "bleeding", "suppuration", "radiograph" }
            : ["healing", "crown", "occlusion", "hygiene", "outcome"];
        foreach (var field in fields) Require(visit, field);
        ValidateChoices(visit, stage);
        OptionalNumber(visit, "probingDepth", 0, 20);
    }

    public static string Text(JsonElement data, string field) => data.ValueKind == JsonValueKind.Object && data.TryGetProperty(field, out var value) && value.ValueKind is JsonValueKind.String or JsonValueKind.Number ? value.ToString().Trim() : "";
    private static void ValidateShape(JsonElement root)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (property.Name is "healingVisits" or "followupVisits")
            {
                if (property.Value.ValueKind != JsonValueKind.Array || property.Value.GetArrayLength() > 100) throw new ArgumentException("Too many follow-up visits.");
                var identifiers = new HashSet<string>(StringComparer.Ordinal);
                foreach (var visit in property.Value.EnumerateArray())
                {
                    if (visit.ValueKind != JsonValueKind.Object || !Guid.TryParse(Text(visit, "id"), out var id) || id == Guid.Empty || !identifiers.Add(id.ToString())) throw new ArgumentException("Each visit needs a unique identifier.");
                    ValidateObject(visit);
                }
            }
            else if (property.Name != "schemaVersion")
            {
                if (property.Name is not ("planning" or "placement" or "abutment" or "scan" or "fixation") || property.Value.ValueKind != JsonValueKind.Object) throw new ArgumentException("Invalid implant stage.");
                ValidateObject(property.Value);
            }
        }
    }
    private static void ValidateObject(JsonElement data)
    {
        foreach (var property in data.EnumerateObject())
        {
            if (property.Name.Length > 80 || property.Value.ValueKind == JsonValueKind.String && property.Value.GetString()!.Length > 4000) throw new ArgumentException("Shorten the implant notes.");
            if (property.Value.ValueKind == JsonValueKind.Object)
            {
                if (property.Name != "next") throw new ArgumentException("Invalid implant field.");
                foreach (var value in property.Value.EnumerateObject())
                    if (value.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array || value.Value.ToString().Length > 500) throw new ArgumentException("Invalid follow-up appointment.");
            }
            if (property.Value.ValueKind == JsonValueKind.Array && (property.Value.GetArrayLength() > 30 || property.Value.EnumerateArray().Any(x => x.ValueKind != JsonValueKind.String || x.GetString()!.Length > 80))) throw new ArgumentException("Invalid selection.");
        }
    }
    private static void Require(JsonElement data, string field)
    { if (Text(data, field).Length is 0 or > 4000) throw new ArgumentException($"Complete the {field} field."); }
    private static void Date(JsonElement data, string field)
    { if (!DateOnly.TryParseExact(Text(data, field), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) throw new ArgumentException("Enter a valid visit date."); }
    private static void Number(JsonElement data, string field, decimal min, decimal max)
    { if (!decimal.TryParse(Text(data, field), NumberStyles.Number, CultureInfo.InvariantCulture, out var value) || value < min || value > max) throw new ArgumentException($"Enter a valid {field} between {min} and {max}."); }
    private static void OptionalNumber(JsonElement data, string field, decimal min, decimal max)
    { if (Text(data, field).Length > 0) Number(data, field, min, max); }
    private static void Choice(JsonElement data, string field, string allowed)
    {
        var value = Text(data, field);
        if (value.Length > 0 && !allowed.Split('|').Contains(value, StringComparer.Ordinal)) throw new ArgumentException($"Choose a valid {field} option.");
    }
    private static void ValidateChoices(JsonElement data, int stage)
    {
        switch (stage)
        {
            case 1:
                Choice(data, "imaging", "cbct|xray|none"); Choice(data, "timing", "immediate|delayed|undecided"); Choice(data, "graft", "yes|no|assess"); Choice(data, "guide", "yes|no"); break;
            case 2:
                Choice(data, "placementType", "delayed|immediate|provisional"); Choice(data, "stability", "good|low|unstable"); Choice(data, "component", "cover|healing");
                Choice(data, "graftType", "autograft|allograft|xenograft|synthetic|other"); Choice(data, "graftUnit", "cc|g"); break;
            case 3:
                Choice(data, "healingType", "submerged|transmucosal"); Choice(data, "status", "normal|delayed|complication"); Choice(data, "softTissue", "healthy|mild|inflamed|other");
                Choice(data, "mobility", "none|slight|mobile"); Choice(data, "pain", "none|mild|moderate|severe"); Choice(data, "boneLevel", "stable|slight|significant|unclear");
                Choice(data, "nextPlan", "continue|expose|prosthetic"); Choice(data, "bleeding", "yes|no"); Choice(data, "suppuration", "yes|no"); Choice(data, "radiograph", "xray|cbct|none"); break;
            case 4: Choice(data, "type", "stock|custom|tibase"); break;
            case 5:
                Choice(data, "scanType", "digital|conventional"); Choice(data, "coping", "scanbody|closed|open"); Choice(data, "crownType", "zirconia|emax|pfm|metal|other");
                Choice(data, "shadeSystem", "vita|3d|custom"); Choice(data, "delivery", "inhouse|lab"); break;
            case 6:
                Choice(data, "retention", "screw|cement"); Choice(data, "seating", "final|tryin|temporary"); Choice(data, "occlusion", "satisfactory|minor|major"); Choice(data, "stability", "stable|slight|unstable"); break;
            case 7:
                Choice(data, "healing", "excellent|good|attention"); Choice(data, "crown", "stable|discomfort|adjustment"); Choice(data, "occlusion", "satisfactory|minor|review");
                Choice(data, "hygiene", "good|reinforce"); Choice(data, "outcome", "successful|monitor|intervention"); break;
        }
    }
}

public sealed class ImplantAttachment : TenantOwnedEntity
{
    private ImplantAttachment() { }
    public ImplantAttachment(Guid tenantId, Guid recordId, string section, string name, string contentType, byte[] content, DateTimeOffset now)
    { TenantId = tenantId; ImplantRecordId = recordId; Section = section; FileName = name; ContentType = contentType; Content = content; CreatedAt = now; }
    public Guid ImplantRecordId { get; private set; }
    public string Section { get; private set; } = "";
    public string FileName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public byte[] Content { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
}
