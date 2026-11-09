using System.Text.Json;
using System.Globalization;
using DentalClinic.Application.Crm;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Identity;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed record SaveClinicalWorkflowRequest(Guid Version, string Kind, JsonElement Plan, Guid SessionId,
    Guid AppointmentId, JsonElement Data, bool Performed, string? ApprovedStep = null);
public sealed record ClinicalWorkflowDetails(Guid TreatmentId, Guid PatientId, Guid DoctorProfileId, Guid Version,
    string? WorkflowJson);

public sealed record ClinicalPhotoDetails(Guid Id, Guid SessionId, string Category, string FileName, string ContentType, DateTimeOffset CreatedAt);
public sealed record CorrectClinicalSessionRequest(Guid Version, string Reason);
public sealed class ClinicalWorkflowService(ApplicationDbContext db, IPermissionService permissions, ICurrentUser actor, IFollowUpCreator followUps)
{
    public async Task<ClinicalWorkflowDetails> GetAsync(Guid id, CancellationToken token)
    {
        var treatment = await FindAsync(id, token);
        return Details(treatment);
    }
    public async Task<ClinicalWorkflowDetails> SaveAsync(Guid id, SaveClinicalWorkflowRequest request, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalEdit, token);
        await permissions.EnsurePermissionAsync(Permissions.ExaminationEdit, token);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var lockKey = "clinical-workflow:" + id;
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))", token);
        var treatment = await FindAsync(id, token);
        var serviceName = (treatment.TreatmentName + " " + await db.TreatmentCatalogItems.Where(x => x.Id == treatment.TreatmentCatalogItemId).Select(x => x.Code).SingleAsync(token)).ToLowerInvariant();
        var matchesService = request.Kind == "scaling"
            ? "scal|polish|clean|تنظيف|تنضيف|جير".Split('|').Any(term => serviceName.Contains(term, StringComparison.Ordinal))
            : request.Kind == "bleaching" && "whiten|bleach|تبييض|تبيض".Split('|').Any(term => serviceName.Contains(term, StringComparison.Ordinal));
        if (!matchesService) throw new ArgumentException("Choose the workflow matching this clinic service.");
        var appointment = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.AppointmentId &&
            x.PatientId == treatment.PatientId && x.DoctorProfileId == treatment.DoctorProfileId, token)
            ?? throw new KeyNotFoundException("The clinical visit must belong to this patient and doctor.");
        if (!await db.Examinations.AnyAsync(x => x.AppointmentId == appointment.Id && x.Status == DentalClinic.Domain.Dental.ExaminationStatus.Draft, token))
            throw new ArgumentException("Save clinical changes from an open examination.");
        if (request.Plan.ValueKind != JsonValueKind.Object || request.Data.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("Invalid clinical workflow data.");
        var zone = TimeZoneInfo.FindSystemTimeZoneById(await db.TenantConfigurations.Select(x => x.TimeZone).SingleAsync(token));
        var visitDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(appointment.StartAt, zone).DateTime);
        try
        {
            treatment.SaveClinicalWorkflow(request.Kind, request.Plan.GetRawText(), request.SessionId, appointment.Id,
                actor.UserId ?? throw new ForbiddenAccessException("Sign in before recording a clinical session."), visitDate,
                request.Data.GetRawText(), request.Performed, request.Version, DateTimeOffset.UtcNow, request.ApprovedStep);
        }
        catch (InvalidOperationException) { throw new ArgumentException("Check the format of the clinical fields."); }
        if (request.Kind == "scaling" && request.Performed && request.Data.TryGetProperty("requestRecall", out var recall) && recall.ValueKind == JsonValueKind.True)
        {
            var dateText = request.Data.TryGetProperty("recallDate", out var dateValue) ? dateValue.GetString() : null;
            if (!DateOnly.TryParseExact(dateText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var recallDate) || recallDate <= visitDate)
                throw new ArgumentException("Choose a proposed follow-up date after this visit.");
            var requestTitle = "Scaling recall request";
            var local = recallDate.ToDateTime(new TimeOnly(9, 0)); var due = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone));
            var reason = request.Data.TryGetProperty("recallReason", out var reasonValue) ? reasonValue.GetString() : null;
            var doctorName = await (from doctor in db.DoctorProfiles join member in db.ClinicUsers on doctor.ClinicUserId equals member.Id where doctor.Id == treatment.DoctorProfileId select member.DisplayName).SingleAsync(token);
            var existing = await db.FollowUps.SingleOrDefaultAsync(x => x.RelatedTreatmentId == id && x.RelatedAppointmentId == appointment.Id && x.Title == requestTitle, token);
            if (existing is null)
            {
                var reception = await (from assignment in db.UserRoleAssignments
                                       join role in db.TenantRoles on assignment.RoleId equals role.Id
                                       join member in db.ClinicUsers on assignment.UserId equals member.Id
                                       where role.Name == SystemRoleDefinitions.Receptionist && member.Status == UserStatus.Active
                                       orderby member.Id
                                       select (Guid?)member.Id).FirstOrDefaultAsync(token)
                    ?? throw new ArgumentException("No active receptionist is configured. Save a draft and assign reception before sending a follow-up request.");
                await followUps.CreateAsync(new FollowUpCreationRequest(treatment.PatientId, FollowUpType.PostTreatment, due, requestTitle, reception,
                    $"طلب متابعة مقترح يحتاج تنسيق الحجز من الاستقبال. الطبيب: {doctorName}. السبب: {reason}", RelatedAppointmentId: appointment.Id, RelatedTreatmentId: id), token);
            }
            else if (existing.DueAt != due)
            {
                await permissions.EnsurePermissionAsync(Permissions.CrmEditFollowUp, token);
                if (existing.IsTerminal) throw new ArgumentException("Reception has already closed this follow-up request. Coordinate further changes with reception.");
                existing.Update(existing.Type, due, existing.Title, $"طلب متابعة مقترح يحتاج تنسيق الحجز من الاستقبال. الطبيب: {doctorName}. السبب: {reason}", existing.RelatedAppointmentId, existing.RelatedTreatmentPlanId, existing.RelatedTreatmentId, existing.RelatedPrescriptionId, existing.Version, DateTimeOffset.UtcNow);
            }
        }
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { throw new TreatmentConcurrencyException("This treatment changed. Reload before saving."); }
        await transaction.CommitAsync(token); return Details(treatment);
    }
    public async Task<IReadOnlyList<ClinicalPhotoDetails>> PhotosAsync(Guid id, CancellationToken token)
    { await FindAsync(id, token); return await db.ClinicalPhotos.Where(x => x.TreatmentId == id).OrderBy(x => x.CreatedAt).Select(x => new ClinicalPhotoDetails(x.Id, x.SessionId, x.Category, x.FileName, x.ContentType, x.CreatedAt)).ToListAsync(token); }
    public async Task<ClinicalWorkflowDetails> CorrectSessionAsync(Guid id, Guid sessionId, CorrectClinicalSessionRequest request, CancellationToken token)
    {
        var treatment = await FindAsync(id, token); await EnsureEditableSessionAsync(treatment, sessionId, token);
        treatment.RetractClinicalSession(sessionId, actor.UserId ?? throw new ForbiddenAccessException("Sign in first."), request.Reason, request.Version, DateTimeOffset.UtcNow);
        try { await db.SaveChangesAsync(token); } catch (DbUpdateConcurrencyException) { throw new TreatmentConcurrencyException("This treatment changed. Reload first."); }
        return Details(treatment);
    }
    public async Task<ClinicalPhoto> PhotoAsync(Guid id, Guid fileId, CancellationToken token)
    { await FindAsync(id, token); return await db.ClinicalPhotos.SingleOrDefaultAsync(x => x.Id == fileId && x.TreatmentId == id, token) ?? throw new KeyNotFoundException("Photo not found."); }
    private async Task EnsureEditableSessionAsync(Treatment treatment, Guid sessionId, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalEdit, token); await permissions.EnsurePermissionAsync(Permissions.ExaminationEdit, token);
        if (treatment.Status is TreatmentStatus.Completed or TreatmentStatus.Cancelled) throw new ArgumentException("Completed treatment photos are read-only.");
        using var document = JsonDocument.Parse(treatment.ClinicalWorkflowJson ?? "{}");
        if (!document.RootElement.TryGetProperty("visits", out var visits)) throw new ArgumentException("Save the session first.");
        var visit = visits.EnumerateArray().FirstOrDefault(x => x.GetProperty("id").GetString() == sessionId.ToString());
        if (visit.ValueKind == JsonValueKind.Undefined || !Guid.TryParse(visit.GetProperty("appointmentId").GetString(), out var appointmentId) ||
           !await db.Examinations.AnyAsync(x => x.AppointmentId == appointmentId && x.PatientId == treatment.PatientId && x.Status == DentalClinic.Domain.Dental.ExaminationStatus.Draft, token)) throw new ArgumentException("Photos can only be changed for an open clinical visit.");
    }
    public async Task<ClinicalPhotoDetails> AddPhotoAsync(Guid id, Guid sessionId, string category, string name, byte[] bytes, CancellationToken token)
    {
        var treatment = await FindAsync(id, token); await EnsureEditableSessionAsync(treatment, sessionId, token);
        if (category is not ("before" or "after") || name.Length is 0 or > 200 || bytes.Length is 0 or > 10_000_000) throw new ArgumentException("Choose a before/after photo smaller than 10 MB.");
        var extension = Path.GetExtension(name).ToLowerInvariant();
        var mime = extension switch
        {
            ".jpg" or ".jpeg" when bytes.Length > 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 => "image/jpeg",
            ".png" when bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) => "image/png",
            ".webp" when bytes.Length > 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" => "image/webp",
            _ => throw new ArgumentException("Supported photos: JPG, PNG and WebP.")
        };
        if (await db.ClinicalPhotos.CountAsync(x => x.TreatmentId == id, token) >= 200) throw new ArgumentException("This treatment supports up to 200 photos.");
        var file = new ClinicalPhoto(treatment.TenantId, id, sessionId, category, Path.GetFileName(name), mime, bytes, DateTimeOffset.UtcNow);
        db.ClinicalPhotos.Add(file); await db.SaveChangesAsync(token); return new(file.Id, file.SessionId, file.Category, file.FileName, file.ContentType, file.CreatedAt);
    }
    public async Task DeletePhotoAsync(Guid id, Guid fileId, CancellationToken token)
    { var treatment = await FindAsync(id, token); var file = await PhotoAsync(id, fileId, token); await EnsureEditableSessionAsync(treatment, file.SessionId, token); db.ClinicalPhotos.Remove(file); await db.SaveChangesAsync(token); }
    private async Task<Treatment> FindAsync(Guid id, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalView, token);
        var treatment = await db.Treatments.SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Treatment not found.");
        if (!await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token) &&
            !await db.DoctorProfiles.AnyAsync(x => x.Id == treatment.DoctorProfileId && x.ClinicUserId == actor.UserId, token))
            throw new ForbiddenAccessException("Only the treating doctor or an authorized manager can access this workflow.");
        return treatment;
    }
    private static ClinicalWorkflowDetails Details(Treatment treatment) => new(treatment.Id, treatment.PatientId, treatment.DoctorProfileId, treatment.Version, treatment.ClinicalWorkflowJson);
}
