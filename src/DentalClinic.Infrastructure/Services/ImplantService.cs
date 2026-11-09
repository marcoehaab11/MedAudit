using System.Globalization;
using System.Text.Json;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed record ImplantDetails(Guid Id, Guid PatientId, string PatientName, string PatientNumber, int ToothNumber,
    Guid DoctorProfileId, string DoctorName, Guid? TreatmentId, JsonElement Workflow, int CompletedStep, Guid Version, int PatientAge);
public sealed record SaveImplantRequest(Guid Version, JsonElement Workflow, int? CompleteStep = null, string? ConfirmedVisitId = null, int? ConfirmedVisitStage = null, Guid? AppointmentId = null);
public sealed record ImplantFileInfo(Guid Id, string Section, string FileName, string ContentType);

public sealed class ImplantService(ApplicationDbContext db, ICurrentTenant tenant, ICurrentUser actor,
    IPermissionService permissions, ICreateAppointment appointments, IRescheduleAppointment reschedule, ITreatmentService treatments)
{
    public async Task<IReadOnlyList<ImplantDetails>> ListAsync(Guid patientId, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalView, token);
        var query = db.ImplantRecords.Where(x => x.PatientId == patientId);
        if (!await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token))
            query = query.Where(x => db.DoctorProfiles.Any(d => d.Id == x.DoctorProfileId && d.ClinicUserId == actor.UserId));
        var records = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var result = new List<ImplantDetails>();
        foreach (var record in records) result.Add(await DetailsAsync(record, token));
        return result;
    }

    public async Task<ImplantDetails> CreateAsync(Guid patientId, int tooth, Guid appointmentId, Guid? treatmentId, CancellationToken token)
    {
        await EditPermissionAsync(token);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var creationKey = $"implant:{tenant.RequireTenantId()}:{patientId}:{tooth}:{treatmentId}";
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({creationKey}, 0))", token);
        var appointment = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == appointmentId && x.PatientId == patientId, token)
            ?? throw new KeyNotFoundException("Clinical appointment not found.");
        await EnsureDoctorAsync(appointment.DoctorProfileId, token);
        if (treatmentId.HasValue && !await db.Treatments.AnyAsync(x => x.Id == treatmentId && x.PatientId == patientId && x.DoctorProfileId == appointment.DoctorProfileId && x.Type == TreatmentType.Implant && x.Teeth.Any(t => t.ToothNumber == tooth), token))
            throw new ArgumentException("The implant treatment must belong to this patient, doctor and tooth.");
        var existing = await db.ImplantRecords.SingleOrDefaultAsync(x => x.PatientId == patientId && x.ToothNumber == tooth && x.TreatmentId == treatmentId && x.DoctorProfileId == appointment.DoctorProfileId, token);
        if (existing is not null) { await transaction.CommitAsync(token); return await DetailsAsync(existing, token); }
        var record = new ImplantRecord(tenant.RequireTenantId(), patientId, tooth, appointment.DoctorProfileId, treatmentId, DateTimeOffset.UtcNow);
        db.ImplantRecords.Add(record); await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return await DetailsAsync(record, token);
    }

    public async Task<ImplantDetails> GetAsync(Guid id, CancellationToken token) => await DetailsAsync(await FindAsync(id, token), token);

    public async Task<ImplantDetails> SaveAsync(Guid id, SaveImplantRequest request, CancellationToken token)
    {
        await EditPermissionAsync(token);
        if (request.Workflow.ValueKind != JsonValueKind.Object) throw new ArgumentException("Invalid implant workflow.");
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var record = await db.ImplantRecords.FromSqlInterpolated($"SELECT * FROM implant_records WHERE \"Id\"={id} FOR UPDATE").SingleOrDefaultAsync(token)
            ?? throw new KeyNotFoundException("Implant record not found.");
        await EnsureDoctorAsync(record.DoctorProfileId, token);
        if (request.AppointmentId.HasValue && !await db.Appointments.AnyAsync(a => a.Id == request.AppointmentId && a.PatientId == record.PatientId && a.DoctorProfileId == record.DoctorProfileId, token))
            throw new ArgumentException("The clinical visit must match this implant's patient and doctor.");
        record.Save(request.Workflow.GetRawText(), request.CompleteStep, request.Version, DateTimeOffset.UtcNow,
            request.ConfirmedVisitId, request.ConfirmedVisitStage, request.AppointmentId);
        await SynchronizeAppointmentsAsync(record, request.Workflow, token);
        if (request.CompleteStep == 7 && record.TreatmentId.HasValue)
        {
            var treatment = await db.Treatments.SingleAsync(x => x.Id == record.TreatmentId.Value, token);
            if (treatment.Status != TreatmentStatus.Completed)
            {
                await permissions.EnsurePermissionAsync(Permissions.TreatmentsComplete, token);
                // Keep the existing treatment/billing workflow in charge of completion.
                await db.SaveChangesAsync(token);
                await treatments.TransitionAsync(treatment.Id, "complete", treatment.Version, token);
            }
        }
        await db.SaveChangesAsync(token); await transaction.CommitAsync(token);
        return await DetailsAsync(record, token);
    }

    public async Task<ImplantRecord> FindAsync(Guid id, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalView, token);
        var record = await db.ImplantRecords.SingleOrDefaultAsync(x => x.Id == id, token) ?? throw new KeyNotFoundException("Implant record not found.");
        await EnsureDoctorAsync(record.DoctorProfileId, token); return record;
    }

    public async Task<IReadOnlyList<ImplantFileInfo>> FilesAsync(Guid id, CancellationToken token)
    {
        await FindAsync(id, token);
        return await db.ImplantAttachments.Where(x => x.ImplantRecordId == id)
            .OrderBy(x => x.CreatedAt).Select(x => new ImplantFileInfo(x.Id, x.Section, x.FileName, x.ContentType)).ToListAsync(token);
    }

    public async Task<ImplantAttachment> FileAsync(Guid id, Guid fileId, CancellationToken token)
    {
        await FindAsync(id, token);
        return await db.ImplantAttachments.SingleOrDefaultAsync(x => x.Id == fileId && x.ImplantRecordId == id, token)
            ?? throw new KeyNotFoundException("Attachment not found.");
    }

    public async Task<ImplantFileInfo> AddFileAsync(Guid id, string section, string name, byte[] bytes, CancellationToken token)
    {
        await EditPermissionAsync(token); var record = await FindAsync(id, token);
        using var workflow = JsonDocument.Parse(record.WorkflowJson);
        if (section is not ("placement" or "abutment" or "scan" or "fixation"))
        {
            var parts = section.Split(':', 2);
            if (parts.Length != 2 || parts[0] is not ("healingVisits" or "followupVisits") ||
                !workflow.RootElement.TryGetProperty(parts[0], out var visits) ||
                !visits.EnumerateArray().Any(visit => ImplantRecord.Text(visit, "id") == parts[1]))
                throw new ArgumentException("Save the visit before attaching a file to it.");
        }
        if (section.Length is 0 or > 80 || name.Length is 0 or > 200 || bytes.Length is 0 or > 10_000_000)
            throw new ArgumentException("Choose a file smaller than 10 MB with a short file name.");
        var extension = Path.GetExtension(name).ToLowerInvariant();
        var type = extension switch
        {
            ".jpg" or ".jpeg" when bytes.Length > 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 => "image/jpeg",
            ".png" when bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) => "image/png",
            ".webp" when bytes.Length > 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" => "image/webp",
            ".pdf" when bytes.AsSpan().StartsWith("%PDF-"u8) => "application/pdf",
            ".stl" or ".ply" => "application/octet-stream",
            _ => throw new ArgumentException("Supported files: JPG, PNG, WebP, PDF, STL and PLY.")
        };
        if (await db.ImplantAttachments.CountAsync(x => x.ImplantRecordId == id, token) >= 100)
            throw new ArgumentException("An implant record supports up to 100 attachments.");
        var file = new ImplantAttachment(tenant.RequireTenantId(), id, section, Path.GetFileName(name), type, bytes, DateTimeOffset.UtcNow);
        db.ImplantAttachments.Add(file); await db.SaveChangesAsync(token);
        return new ImplantFileInfo(file.Id, file.Section, file.FileName, file.ContentType);
    }

    public async Task DeleteFileAsync(Guid id, Guid fileId, CancellationToken token)
    {
        await EditPermissionAsync(token); var file = await FileAsync(id, fileId, token);
        db.ImplantAttachments.Remove(file); await db.SaveChangesAsync(token);
    }

    public async Task EditPermissionAsync(CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.DentalEdit, token); await permissions.EnsurePermissionAsync(Permissions.ExaminationEdit, token); }

    private async Task EnsureDoctorAsync(Guid doctorId, CancellationToken token)
    {
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token)) return;
        if (!await db.DoctorProfiles.AnyAsync(x => x.Id == doctorId && x.ClinicUserId == actor.UserId, token))
            throw new ForbiddenAccessException("Doctors may only access their own implant records.");
    }

    private async Task<ImplantDetails> DetailsAsync(ImplantRecord record, CancellationToken token)
    {
        var patient = await db.Patients.AsNoTracking().SingleAsync(x => x.Id == record.PatientId, token);
        var doctorName = await (from doctor in db.DoctorProfiles join user in db.ClinicUsers on doctor.ClinicUserId equals user.Id
            where doctor.Id == record.DoctorProfileId select user.DisplayName).SingleAsync(token);
        using var json = JsonDocument.Parse(record.WorkflowJson);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var age = today.Year - patient.DateOfBirth.Year;
        if (patient.DateOfBirth.AddYears(age) > today) age--;
        return new ImplantDetails(record.Id, patient.Id, patient.FirstName + " " + patient.LastName, patient.PatientNumber,
            record.ToothNumber, record.DoctorProfileId, doctorName, record.TreatmentId, json.RootElement.Clone(), record.CompletedStep, record.Version, age);
    }

    private async Task SynchronizeAppointmentsAsync(ImplantRecord record, JsonElement workflow, CancellationToken token)
    {
        var links = JsonSerializer.Deserialize<Dictionary<string, Guid>>(record.AppointmentLinksJson)!;
        var visits = new List<(string Key, JsonElement Data)>();
        foreach (var stage in new[] { "placement", "fixation" })
            if (workflow.TryGetProperty(stage, out var item)) visits.Add((stage, item));
        foreach (var stage in new[] { "healingVisits", "followupVisits" })
            if (workflow.TryGetProperty(stage, out var items) && items.ValueKind == JsonValueKind.Array)
                foreach (var item in items.EnumerateArray()) visits.Add((stage + ":" + ImplantRecord.Text(item, "id"), item));
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (key, visit) in visits)
        {
            if (!keys.Add(key)) throw new ArgumentException("Follow-up visits must have different identifiers.");
            if (!visit.TryGetProperty("next", out var next) || !next.TryGetProperty("send", out var send) || send.ValueKind != JsonValueKind.True) continue;
            if (!DateOnly.TryParseExact(ImplantRecord.Text(visit, "date"), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var visitDate) ||
                !DateOnly.TryParseExact(ImplantRecord.Text(next, "date"), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) || date <= visitDate ||
                !TimeOnly.TryParseExact(ImplantRecord.Text(next, "time"), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
                throw new ArgumentException("Choose a follow-up date after this visit and a valid appointment time.");
            var notes = "Implant #" + record.ToothNumber + " · " + ImplantRecord.Text(next, "reason");
            var input = new AppointmentTimeInput(date, time, 30);
            if (links.TryGetValue(key, out var appointmentId))
            {
                var existing = await db.Appointments.AsNoTracking().SingleAsync(x => x.Id == appointmentId && x.PatientId == record.PatientId, token);
                var zone = TimeZoneInfo.FindSystemTimeZoneById(await db.TenantConfigurations.Select(x => x.TimeZone).SingleAsync(token));
                var current = TimeZoneInfo.ConvertTime(existing.StartAt, zone);
                if (DateOnly.FromDateTime(current.DateTime) != date || TimeOnly.FromDateTime(current.DateTime) != time)
                {
                    if (!await reschedule.ExecuteAsync(new RescheduleAppointmentCommand(appointmentId, input), token)) throw new KeyNotFoundException("Follow-up appointment not found.");
                }
            }
            else links.Add(key, await appointments.ExecuteAsync(new CreateAppointmentCommand(record.PatientId, record.DoctorProfileId, AppointmentType.FollowUp, input, notes), token));
        }
        record.SetAppointmentLinks(JsonSerializer.Serialize(links));
    }
}
