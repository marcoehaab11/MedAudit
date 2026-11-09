using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Patients;

public sealed record ClinicalTimelineEvent(string Id, Guid? TreatmentId, Guid? AppointmentId, IReadOnlyCollection<int> ToothNumbers,
    string ProcedureName, string Step, string StepEn, string StepAr, DateTimeOffset? PerformedAt, string? ReportedDate = null, bool Corrected = false,
    string? Date = null, string? DayEn = null, string? DayAr = null, string? Time = null);
public sealed record PatientClinicalHistory(DateTimeOffset? FirstExaminationAt, string? FirstExaminationDate,
    string? FirstExaminationDayEn, string? FirstExaminationDayAr, string? FirstExaminationTime, string TimeZone,
    IReadOnlyCollection<ClinicalTimelineEvent> Items, int Page, int PageSize, int TotalCount, int UncertainLegacyRecords);

// Reads executed evidence only. Current treatment status and next-stage numbers are never used to invent steps.
public static class ClinicalTimeline
{
    private static readonly Dictionary<string, (string En, string Ar)> Labels = new(StringComparer.Ordinal)
    {
        ["examination"] = ("Examination", "الكشف"), ["caries-removal"] = ("Caries Removal", "إزالة التسوس"),
        ["temporary-filling"] = ("Temporary Filling", "حشو مؤقت"), ["composite-filling"] = ("Composite Filling", "حشو كومبوزيت"),
        ["amalgam-filling"] = ("Amalgam Filling", "حشو أملغم"), ["glass-ionomer-filling"] = ("Glass Ionomer Filling", "حشو جلاس أيونومر"),
        ["filling"] = ("Filling", "الحشو"), ["extraction"] = ("Extraction", "الخلع"),
        ["access"] = ("Access Cavity", "فتح حجرة العصب"), ["length"] = ("Working Length & Final File Size", "تسجيل أطوال القنوات ومقاسات الملفات"),
        ["obturation"] = ("Obturation", "حشو قنوات العصب"), ["core"] = ("Permanent Core Build-up", "الحشو الخارجي الدائم"), ["post"] = ("Post Placement", "تركيب الدعامة"),
        ["crown-preparation"] = ("Crown Preparation", "تحضير السن للكراون"), ["crown-impression"] = ("Impression / Scan", "الطبعة أو المسح"),
        ["crown-temporary"] = ("Temporary Crown", "كراون مؤقت"), ["crown-tryin"] = ("Crown Try-in", "تجربة الكراون"), ["crown-cementation"] = ("Crown Cementation", "تثبيت الكراون"),
        ["scaling"] = ("Scaling", "تنظيف الجير"), ["polishing"] = ("Polishing", "التلميع"), ["fluoride"] = ("Fluoride Application", "تطبيق الفلورايد"),
        ["pocket-mapping"] = ("Pocket Mapping", "تسجيل قياسات الجيوب اللثوية"), ["pocket-treatment"] = ("Pocket Treatment", "علاج الجيوب اللثوية"),
        ["bleaching"] = ("Bleaching Session", "جلسة تبييض منفذة"), ["implant-1"] = ("Implant Assessment & Planning", "تقييم وتخطيط الزراعة"),
        ["implant-2"] = ("Implant Placement", "زراعة الغرسة"), ["implant-healing"] = ("Implant Healing Review", "متابعة الالتئام"),
        ["implant-4"] = ("Abutment Placement", "تركيب الدعامة"), ["implant-5"] = ("Scan / Impression & Crown Details", "المسح أو الطبعة وبيانات التركيبة"),
        ["implant-6"] = ("Final Fixation", "التثبيت النهائي"), ["implant-followup"] = ("Implant Follow-up", "متابعة الزراعة"),
        ["procedure-completed"] = ("Procedure Completed", "الإجراء المنفذ مكتمل")
    };
    public static ClinicalTimelineEvent Event(string id, Guid? treatmentId, Guid? appointmentId, IReadOnlyCollection<int> teeth,
        string name, string step, DateTimeOffset? at, string? reportedDate = null, bool corrected = false)
    {
        var label = Labels.GetValueOrDefault(step, ("Performed procedure", "إجراء منفذ"));
        return new(id, treatmentId, appointmentId, teeth, name, step, label.Item1, label.Item2, at, reportedDate, corrected);
    }
    public static IEnumerable<ClinicalTimelineEvent> TreatmentEvents(Treatment treatment)
    {
        if (treatment.ParentTreatmentId.HasValue) yield break; // represented by the parent's performed step, not billed twice in history
        var teeth = treatment.Teeth.Select(t => t.ToothNumber).Order().ToArray();
        var flow = ParseFlow(treatment.ClinicalWorkflowJson);
        if (flow?["kind"]?.ToString() is "scaling" or "bleaching" || treatment.Type == TreatmentType.Other && teeth.Length == 32) teeth = [];
        var stored = Array(treatment.ExecutedStepsJson);
        foreach (var e in stored)
        {
            var step = Text(e, "step");
            if (step == "procedure-completed") step = treatment.Type == TreatmentType.Filling ? FillingStep(treatment.Notes) : treatment.Type == TreatmentType.Extraction ? "extraction" : step;
            yield return Event($"{(step is "scaling" or "pocket-mapping" or "pocket-treatment" ? "clinical" : "treatment")}:{treatment.Id}:{Text(e, "key")}", treatment.Id, Id(e, "appointmentId"), teeth,
                treatment.TreatmentName, step, At(e, "performedAt"), Text(e, "reportedDate"),
                (flow?["visits"] as JsonArray)?.Any(v => Text(v,"id") == Text(e,"key").Split(':')[0] && Text(v,"performed") != "true" && v?["correctedAt"] is not null) == true);
        }
        if (flow?["progress"] is JsonObject progress)
        {
            foreach (var step in progress.Where(p => p.Value?["completed"]?.ToString() == "true" && p.Value?["legacyImported"]?.ToString() != "true"))
                if (Labels.ContainsKey(step.Key)) yield return Event($"root:{treatment.Id}:{step.Key}", treatment.Id, Id(step.Value, "appointmentId"), teeth,
                    treatment.TreatmentName, step.Key, At(step.Value, "completedAt"));
            if (flow["temporaryFillings"] is JsonArray temporary)
                foreach (var e in temporary) yield return Event($"root:{treatment.Id}:temporary:{Text(e, "examinationId")}", treatment.Id, Id(e, "appointmentId"), teeth,
                    treatment.TreatmentName, "temporary-filling", At(e, "completedAt"));
        }
        if (flow?["kind"]?.ToString() is "scaling" or "bleaching" && flow["visits"] is JsonArray visits)
        {
            foreach (var visit in visits)
            {
                var snapshots = (visit?["revisions"] as JsonArray ?? []).Where(r => r?["performed"]?.ToString() == "true").ToList();
                if (visit?["performed"]?.ToString() == "true") snapshots.Add(visit);
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var snapshot in snapshots.OrderBy(s => At(s, "savedAt")))
                {
                    var data = snapshot?["data"]; var steps = new List<string>();
                    if (Text(flow, "kind") == "bleaching") steps.Add("bleaching");
                    else
                    {
                        if (Text(data, "scalingPerformed") == "true") steps.Add("scaling");
                        if (Text(data, "polishing") == "yes") steps.Add("polishing");
                        if (Text(data, "fluoride") == "yes") steps.Add("fluoride");
                        if (data?["pockets"] is JsonArray pockets && pockets.Count > 0)
                        {
                            steps.Add("pocket-mapping");
                            if (pockets.Any(p => Text(p, "treatmentStatus") == "performed" && Text(p, "treatment").Length > 0)) steps.Add("pocket-treatment");
                        }
                    }
                    foreach (var step in steps.Where(seen.Add)) yield return Event($"clinical:{treatment.Id}:{Text(visit, "id")}:{step}", treatment.Id,
                        Id(visit, "appointmentId"), [], treatment.TreatmentName, step, At(snapshot, "savedAt"), Text(visit, "date"), Text(visit, "performed") != "true");
                }
            }
        }
        if (stored.Count == 0 && flow is null && treatment.Status == TreatmentStatus.Completed && !treatment.IsClinicalFlowContainer && treatment.Type is not (TreatmentType.RootCanal or TreatmentType.Crown or TreatmentType.Implant))
            yield return Event($"treatment:{treatment.Id}:completed", treatment.Id, treatment.AppointmentId, teeth, treatment.TreatmentName,
                treatment.Type == TreatmentType.Filling ? FillingStep(treatment.Notes) : treatment.Type == TreatmentType.Extraction ? "extraction" : "procedure-completed", treatment.CompletedAt);
    }
    public static IEnumerable<ClinicalTimelineEvent> ImplantEvents(ImplantRecord record)
    {
        var stored = Array(record.ExecutedStepsJson);
        foreach (var e in stored)
            yield return Event($"implant:{record.Id}:{Text(e, "key")}", record.TreatmentId, Id(e, "appointmentId"), [record.ToothNumber],
                "Implant / زراعة", Text(e, "step"), At(e, "performedAt"), Text(e, "reportedDate"));
        var flow = ParseFlow(record.WorkflowJson);
        for (var stage = 1; stage <= record.CompletedStep; stage++)
        {
            var code = stage == 3 ? "implant-healing" : stage == 7 ? "implant-followup" : $"implant-{stage}";
            if (stored.Any(e => Text(e,"step") == code)) continue;
            var section = stage switch { 1 => "planning", 2 => "placement", 4 => "abutment", 5 => "scan", 6 => "fixation", _ => "" };
            yield return Event($"implant:{record.Id}:legacy-stage:{stage}", record.TreatmentId, null, [record.ToothNumber],
                "Implant / زراعة", code, null, section.Length > 0 ? Text(flow?[section], "date") : null);
        }
    }
    public static IEnumerable<ClinicalTimelineEvent> LegacyRootEvents(Guid recordId, Guid? treatmentId, Guid? appointmentId,
        int tooth, string? workflowJson, string procedureName)
    {
        var flow = ParseFlow(workflowJson); if (flow is null) yield break;
        var canonical = flow["flowVersion"]?.ToString() == "2";
        // Legacy stage numbers identify the next pending step. Only explicit done flags are evidence.
        if (!canonical && Text(flow,"obturationDone") == "true")
            yield return Event($"root:{treatmentId ?? recordId}:obturation",treatmentId,appointmentId,[tooth],procedureName,"obturation",null);
        if (flow["crown"] is not JsonObject crown || crown["completed"] is not JsonArray flags) yield break;
        for(var i=0;i<Math.Min(flags.Count,RootTreatmentFlow.CrownKeys.Length);i++)
        {
            var key=RootTreatmentFlow.CrownKeys[i];
            if(flags[i]?.ToString()!="true" || canonical && flow["progress"]?[key]?["legacyImported"]?.ToString()!="true") continue;
            var date=crown["dates"] is JsonArray dates && dates.Count>i ? dates[i]?.ToString() : null;
            yield return Event($"root:{treatmentId ?? recordId}:{key}",treatmentId,appointmentId,[tooth],procedureName,key,null,date);
        }
    }
    public static ClinicalTimelineEvent InZone(ClinicalTimelineEvent e, TimeZoneInfo zone)
    {
        var local = e.PerformedAt.HasValue ? TimeZoneInfo.ConvertTime(e.PerformedAt.Value, zone) : (DateTimeOffset?)null;
        var date = local.HasValue ? DateOnly.FromDateTime(local.Value.DateTime) : DateOnly.TryParseExact(e.ReportedDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var reported) ? reported : (DateOnly?)null;
        return e with { Date = date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), DayEn = date?.ToString("dddd", CultureInfo.GetCultureInfo("en-US")),
            DayAr = date?.ToString("dddd", CultureInfo.GetCultureInfo("ar-EG")), Time = local?.ToString("HH:mm:ss", CultureInfo.InvariantCulture) };
    }
    public static string FillingStep(string? notes) => notes?.Contains("Filling material: Temporary", StringComparison.OrdinalIgnoreCase) == true ? "temporary-filling" : notes?.Contains("Filling material: Composite", StringComparison.OrdinalIgnoreCase) == true ? "composite-filling" :
        notes?.Contains("Filling material: Amalgam", StringComparison.OrdinalIgnoreCase) == true ? "amalgam-filling" :
        notes?.Contains("Filling material: Glass Ionomer", StringComparison.OrdinalIgnoreCase) == true ? "glass-ionomer-filling" : "filling";
    public static JsonObject? ParseFlow(string? json) { try { return json is null ? null : JsonNode.Parse(json) as JsonObject; } catch (JsonException) { return null; } }
    private static JsonArray Array(string json) { try { return JsonNode.Parse(json) as JsonArray ?? []; } catch (JsonException) { return []; } }
    private static string Text(JsonNode? n, string key) => n is JsonObject obj ? obj[key]?.ToString() ?? "" : "";
    private static Guid? Id(JsonNode? n, string key) => Guid.TryParse(Text(n, key), out var id) ? id : null;
    private static DateTimeOffset? At(JsonNode? n, string key) => DateTimeOffset.TryParse(Text(n, key), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var at) ? at : null;
}
