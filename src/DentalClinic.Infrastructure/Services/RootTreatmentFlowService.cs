using System.Text.Json;
using System.Text.Json.Nodes;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed record SaveRootTreatmentFlowRequest(Guid Version, Guid? TreatmentId, Guid CatalogItemId,
    string? Notes, IReadOnlyCollection<EndodonticCanalInput> Canals, string WorkflowJson, string? PostType, string? PostCanal, string? PriceTierId = null, Guid? NewExecutionId = null);
public sealed record RootTreatmentFlowResult(Guid TreatmentId, Guid ExaminationVersion, string WorkflowJson, RootCanalStage Stage, decimal Price);

public sealed class RootTreatmentFlowService(ApplicationDbContext db, IPermissionService permissions, ICurrentUser user,
    ISystemClock clock, ITreatmentRevenueCreator revenue)
{
    private static readonly string[] BundledRootTerms = ["post", "crown", "دعامة", "دعامه", "كراون", "تلبيس", "core", "حشو خارجي"];
    public async Task<RootTreatmentFlowResult> SaveAsync(Guid examinationId, int tooth, SaveRootTreatmentFlowRequest request, CancellationToken token)
    {
        if (request.Canals is null || request.WorkflowJson is null) throw new ArgumentException("Clinical workflow and canals are required.");
        PermanentToothCatalog.Get(tooth);
        await permissions.EnsurePermissionAsync(Permissions.DentalEdit, token);
        await permissions.EnsurePermissionAsync(Permissions.ExaminationEdit, token);
        var actor = user.UserId ?? throw new ForbiddenAccessException("Sign in before saving treatment progress.");
        await using var tx = await db.Database.BeginTransactionAsync(token);
        var examination = await db.Examinations.Include(e => e.EndodonticRecords).ThenInclude(r => r.Canals)
            .SingleOrDefaultAsync(e => e.Id == examinationId, token) ?? throw new KeyNotFoundException("Examination not found.");
        if (examination.DoctorUserId != actor && !await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token))
            throw new ForbiddenAccessException("Only the treating doctor or an authorized manager can save this visit.");
        if (examination.Status != ExaminationStatus.Draft || examination.Version != request.Version)
            throw new DentalConcurrencyException("The visit is closed or has changed. Reload before saving.");
        var appointment = await db.Appointments.SingleAsync(a => a.Id == examination.AppointmentId, token);
        var catalog = await db.TreatmentCatalogItems.SingleOrDefaultAsync(c => c.Id == request.CatalogItemId && c.IsActive, token)
            ?? throw new ArgumentException("Choose an active service from the clinic price list.");
        if (catalog.Type is not (TreatmentType.RootCanal or TreatmentType.Crown)) throw new ArgumentException("Choose root canal or crown treatment.");
        var lockKey = $"root-flow:{examination.PatientId}:{tooth}:{(int)catalog.Type}";
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey},0))", token);
        // A tooth is not an execution identity. Only an explicit record ID resumes prior work.
        var executionId = request.TreatmentId ?? request.NewExecutionId;
        var parent = executionId.HasValue
            ? await db.Treatments.Include(t => t.Teeth).SingleOrDefaultAsync(t => t.Id == executionId, token)
            : null;
        var now = clock.UtcNow;
        if (parent is null)
        {
            if (request.TreatmentId.HasValue) throw new KeyNotFoundException("Treatment not found.");
            await permissions.EnsurePermissionAsync(Permissions.TreatmentsCreate, token);
            if (catalog.Type == TreatmentType.RootCanal && BundledRootTerms.Any(term => catalog.Name.Contains(term, StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("اختر بند حشو عصب مستقلًا من قائمة الأسعار؛ الحشو الخارجي والدعامة والكراون تحتاج بنود أسعار مستقلة حتى لا تتكرر تكلفة الباقة.");
            parent = new Treatment(examination.TenantId, examination.PatientId, appointment.DoctorProfileId, appointment.Id,
                null, null, catalog.Id, null, catalog.Type, catalog.Name, [tooth], RootPrice(catalog, request.PriceTierId), request.Notes, now, true, request.NewExecutionId);
            db.Treatments.Add(parent);
        }
        if (parent.PatientId != examination.PatientId || parent.DoctorProfileId != appointment.DoctorProfileId || parent.ParentTreatmentId.HasValue ||
            parent.Type != catalog.Type || parent.TreatmentCatalogItemId != catalog.Id || parent.Teeth.Count != 1 || parent.Teeth.Single().ToothNumber != tooth)
            throw new ForbiddenAccessException("The treatment must match this patient, tooth, service and doctor.");
        if (parent.Status is TreatmentStatus.Completed or TreatmentStatus.Cancelled) throw new DentalStateException("This treatment is closed.");
        var existing = examination.EndodonticRecords.SingleOrDefault(r => r.TreatmentId == parent.Id && r.ToothNumber == tooth);
        var latest = parent.IsClinicalFlowContainer ? null : await db.EndodonticRecords.AsNoTracking().Include(r => r.Canals)
            .Where(r => r.TreatmentId == parent.Id && r.ToothNumber == tooth).OrderByDescending(r => r.UpdatedAt).FirstOrDefaultAsync(token);
        string? previousJson = parent.IsClinicalFlowContainer ? parent.ClinicalWorkflowJson : null;
        if (previousJson is null && latest is not null)
        {
            var priorAppointment = await db.Examinations.Where(e => e.Id == latest.ExaminationId).Select(e => e.AppointmentId).SingleAsync(token);
            previousJson = RootTreatmentFlow.ImportLegacy(latest, priorAppointment).ToJsonString();
        }
        var submitted = RootTreatmentFlow.Parse(request.WorkflowJson);
        submitted["postType"] = request.PostType; submitted["postCanal"] = request.PostCanal;
        var state = RootTreatmentFlow.Save(previousJson, submitted.ToJsonString(), request.Canals, parent.Type == TreatmentType.Crown,
            examination.Id, appointment.Id, examination.DoctorUserId, now, actor);
        var previous = RootTreatmentFlow.Parse(previousJson ?? "{}");
        var progress = state["progress"]!.AsObject(); var oldProgress = previous["progress"] as JsonObject ?? new JsonObject();
        var zone = TimeZoneInfo.FindSystemTimeZoneById(await db.TenantConfigurations.Select(c => c.TimeZone).SingleAsync(token));
        var visitDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(appointment.StartAt, zone).DateTime).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        state["lastVisitDate"] = visitDate;
        foreach (var step in progress.Where(p => p.Value is JsonObject && !RootTreatmentFlow.Done(oldProgress, p.Key)))
        {
            step.Value!["visitDate"] = visitDate;
            if (step.Value["details"] is JsonObject details) details["sessionNotes"] = request.Notes;
            var crownIndex = Array.IndexOf(RootTreatmentFlow.CrownKeys, step.Key);
            if (crownIndex >= 0 && state["crown"]?["dates"] is JsonArray dates)
            {
                if (string.IsNullOrWhiteSpace(dates[crownIndex]?.ToString())) dates[crownIndex] = visitDate;
                if (!DateOnly.TryParseExact(dates[crownIndex]!.ToString(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out _)) throw new ArgumentException("Choose a valid crown procedure date.");
                step.Value["details"]!["reportedDate"] = dates[crownIndex]!.ToString();
            }
        }
        if (state["temporaryFillings"] is JsonArray temporaryHistory)
            foreach (var entry in temporaryHistory.Where(t => t?["examinationId"]?.ToString() == examination.Id.ToString())) entry!["visitDate"] = visitDate;
        var planAlreadyBilled = parent.TreatmentPlanId.HasValue && await db.Revenues.AnyAsync(r => r.TreatmentPlanId == parent.TreatmentPlanId && r.TreatmentId == null, token);
        var rootAlreadyBilled = planAlreadyBilled || await db.Revenues.AnyAsync(r => r.TreatmentId == parent.Id, token);
        var bundledLegacy = previous["billingReviewRequired"]?.ToString() == "true" || planAlreadyBilled || !parent.IsClinicalFlowContainer && parent.Type == TreatmentType.RootCanal && BundledRootTerms.Any(term => parent.TreatmentName.Contains(term, StringComparison.OrdinalIgnoreCase));
        state["billingReviewRequired"] = bundledLegacy;
        var components = await db.Treatments.Include(t => t.Teeth).Where(t => t.ParentTreatmentId == parent.Id).ToListAsync(token);
        var newlyCompleted = new List<Treatment>();
        async Task Component(string key, string catalogKey, string stepKey, TreatmentType type, bool planned)
        {
            var done = RootTreatmentFlow.Done(progress, stepKey);
            var before = RootTreatmentFlow.Done(oldProgress, stepKey);
            var component = components.SingleOrDefault(t => t.FlowComponentKey == key);
            if (component?.Status == TreatmentStatus.Completed || before && component is null) return;
            if (done && bundledLegacy) throw new DentalStateException("هذا العلاج مرتبط بباقة أو خطة حسابية قديمة. راجع تكاليفها مع الإدارة قبل تسجيل إجراء مالي جديد؛ السجل الطبي السابق محفوظ.");
            var idText = catalogKey == "root" ? parent.TreatmentCatalogItemId.ToString() : state["billingCatalogIds"]?[catalogKey]?.ToString();
            if (!Guid.TryParse(idText, out var catalogId))
            {
                if (done) throw new ArgumentException($"Choose the {catalogKey} procedure from the clinic price list before saving its completion.");
                return;
            }
            if (!planned && !done) return;
            var item = await db.TreatmentCatalogItems.SingleOrDefaultAsync(c => c.Id == catalogId && c.IsActive && c.Type == type, token)
                ?? throw new ArgumentException($"Choose an active {catalogKey} service with the correct treatment type.");
            if (component is not null && component.TreatmentCatalogItemId != item.Id) throw new DentalStateException("The planned service is already linked. Keep its original price-list entry.");
            if (component?.Status == TreatmentStatus.Cancelled) component.ReplanFlowComponent(now);
            if (component is null)
            {
                await permissions.EnsurePermissionAsync(Permissions.TreatmentsCreate, token);
                component = new Treatment(parent.TenantId, parent.PatientId, parent.DoctorProfileId, null, null, null,
                    item.Id, null, item.Type, item.Name, [tooth], catalogKey == "root" ? parent.Price : item.DefaultPrice, $"Clinical flow {parent.Id} / {key}", now, true);
                component.LinkFlowComponent(parent.Id, key); db.Treatments.Add(component); components.Add(component);
            }
            if (done)
            {
                await permissions.EnsurePermissionAsync(Permissions.TreatmentsComplete, token);
                var procedure = examination.AddProcedure(tooth, (DentalProcedureType)item.Type, [],
                    $"{item.Name} / flow {parent.Id} / {key}", actor, examination.Version, now);
                component.CompleteFlowComponent(appointment.Id, component.Version, now, procedure.Id); newlyCompleted.Add(component);
            }
        }
        if (!rootAlreadyBilled && parent.Type == TreatmentType.RootCanal) await Component("root", "root", "obturation", TreatmentType.RootCanal, false);
        await Component("core", "permanent", "core", TreatmentType.Filling, false);
        if (state["temporaryFillings"] is JsonArray temporary && temporary.Any(t => t?["examinationId"]?.ToString() == examination.Id.ToString()))
        {
            // A temporary procedure is completed once per visit; the permanent core remains incomplete.
            progress["temporary-current"] = new JsonObject { ["completed"] = true };
            await Component($"temporary:{examination.Id}", "temporary", "temporary-current", TreatmentType.Filling, false);
            progress.Remove("temporary-current");
        }
        var plannedPost = state["decisionsMade"]?.ToString() == "true" && state["needsPost"]?.ToString() == "true";
        var plannedCrown = parent.Type == TreatmentType.Crown || state["decisionsMade"]?.ToString() == "true" && state["needsCrown"]?.ToString() == "true";
        await Component("post", "post", "post", TreatmentType.Other, plannedPost);
        await Component("crown", parent.Type == TreatmentType.Crown ? "root" : "crown", "crown-cementation", TreatmentType.Crown, plannedCrown);
        foreach (var component in components.Where(c => c.Status is not (TreatmentStatus.Completed or TreatmentStatus.Cancelled) &&
            (c.FlowComponentKey == "post" && !plannedPost || c.FlowComponentKey == "crown" && !plannedCrown)))
        {
            await permissions.EnsurePermissionAsync(Permissions.TreatmentsCancel, token);
            component.Cancel(component.Version, now);
        }
        var stage = (RootCanalStage)RootTreatmentFlow.NextStage(state);
        var restoration = parent.Type == TreatmentType.Crown ? "crown-only" : plannedPost ? plannedCrown ? "post-core-crown" : "post-core" : plannedCrown ? "crown" : "composite";
        var json = state.ToJsonString();
        if (existing is null) examination.AddEndodonticRecord(tooth, request.Notes, request.Canals, actor, examination.Version, now,
            stage, parent.Id, restoration, plannedPost ? request.PostType : null, plannedPost ? request.PostCanal : null, json);
        else examination.UpdateEndodonticRecord(existing.Id, request.Notes, request.Canals, examination.Version, now,
            stage, parent.Id, restoration, plannedPost ? request.PostType : null, plannedPost ? request.PostCanal : null, json);
        parent.SaveRootFlow(json, parent.Version, now);
        if (parent.Status is TreatmentStatus.Planned or TreatmentStatus.Scheduled)
        {
            await permissions.EnsurePermissionAsync(Permissions.TreatmentsStart, token);
            parent.Start(parent.Version, now);
        }
        if (stage == RootCanalStage.Completed)
        {
            await permissions.EnsurePermissionAsync(Permissions.TreatmentsComplete, token);
            parent.Complete(parent.Version, now);
        }
        db.PlatformAuditLogs.Add(new(parent.TenantId, actor, PlatformAuditAction.EndodonticRecordUpdated, "RootTreatmentFlow", parent.Id, now, null));
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { throw new DentalConcurrencyException("The visit or treatment changed. Reload before saving."); }
        foreach (var completed in newlyCompleted) await revenue.EnsureForCompletedTreatmentAsync(completed.Id, token);
        await db.SaveChangesAsync(token); await tx.CommitAsync(token);
        return new(parent.Id, examination.Version, json, stage, parent.Price);
    }
    private static decimal RootPrice(TreatmentCatalogItem catalog, string? tierId)
    {
        if (string.IsNullOrEmpty(tierId) || tierId == "base") return catalog.DefaultPrice;
        if (catalog.Description?.StartsWith('{') != true) throw new ArgumentException("Choose an approved price-list tier.");
        using var document = JsonDocument.Parse(catalog.Description);
        if (document.RootElement.TryGetProperty("priceTiers", out var tiers) && tiers.ValueKind == JsonValueKind.Array)
            foreach (var tier in tiers.EnumerateArray())
                if (tier.TryGetProperty("id", out var id) && id.GetString() == tierId && tier.TryGetProperty("price", out var price) && price.TryGetDecimal(out var value)) return value;
        throw new ArgumentException("Choose an approved price-list tier. A custom browser price is not accepted.");
    }
}
