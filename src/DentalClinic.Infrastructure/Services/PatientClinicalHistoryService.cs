using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed class PatientClinicalHistoryService(ApplicationDbContext db, IPermissionService permissions)
{
    public async Task<PatientClinicalHistory?> GetAsync(Guid patientId, int page, int pageSize, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsViewMedicalHistory, token);
        await permissions.EnsurePermissionAsync(Permissions.DentalView, token);
        if (!await db.Patients.AnyAsync(p => p.Id == patientId, token)) return null;
        if (page < 1 || pageSize is < 1 or > 200 || page > int.MaxValue / pageSize) throw new ArgumentException("Choose a history page of 1 to 200 events.");
        var zoneName = await db.TenantConfigurations.Select(c => c.TimeZone).SingleAsync(token);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneName);
        var examinations = await db.Examinations.AsNoTracking().Where(e => e.PatientId == patientId)
            .Select(e => new { e.Id, e.AppointmentId, e.CreatedAt }).ToListAsync(token);
        var treatments = await db.Treatments.AsNoTracking().Include(t => t.Teeth).Where(t => t.PatientId == patientId).ToListAsync(token);
        var implants = await db.ImplantRecords.AsNoTracking().Where(i => i.PatientId == patientId).ToListAsync(token);
        var endodontics = await db.EndodonticRecords.AsNoTracking().Where(e => e.PatientId == patientId).ToListAsync(token);
        var visitIds = examinations.ToDictionary(e => e.Id, e => e.AppointmentId);
        var names = treatments.ToDictionary(t => t.Id, t => t.TreatmentName);
        var implantTreatmentIds = implants.Select(i => i.TreatmentId).ToHashSet();
        var events = examinations.Select(e => ClinicalTimeline.Event($"examination:{e.Id}", null, e.AppointmentId, [], "Examination / الكشف", "examination", e.CreatedAt))
            .Concat(treatments.Where(t => !implantTreatmentIds.Contains(t.Id)).SelectMany(ClinicalTimeline.TreatmentEvents))
            .Concat(implants.SelectMany(ClinicalTimeline.ImplantEvents))
            .Concat(endodontics.SelectMany(e => ClinicalTimeline.LegacyRootEvents(e.Id, e.TreatmentId, visitIds.GetValueOrDefault(e.ExaminationId), e.ToothNumber, e.WorkflowJson,
                e.TreatmentId.HasValue ? names.GetValueOrDefault(e.TreatmentId.Value, "Root / Crown") : "Root / Crown")))
            .Select(e => ClinicalTimeline.InZone(e, zone)).GroupBy(e => e.Id, StringComparer.Ordinal)
            .Select(g => g.OrderBy(e => e.PerformedAt.HasValue ? 0 : e.Date is not null ? 1 : 2).ThenBy(e => e.PerformedAt).ThenBy(e => e.Date, StringComparer.Ordinal).First())
            .OrderByDescending(e => e.Date, StringComparer.Ordinal).ThenByDescending(e => e.PerformedAt).ThenBy(e => e.Id, StringComparer.Ordinal).ToArray();
        var first = examinations.OrderBy(e => e.CreatedAt).FirstOrDefault();
        var firstEvent = first is null ? null : ClinicalTimeline.InZone(ClinicalTimeline.Event("first", null, first.AppointmentId, [], "", "examination", first.CreatedAt), zone);
        var uncertain = treatments.Count(t => t.Type is DentalClinic.Domain.Treatments.TreatmentType.RootCanal or DentalClinic.Domain.Treatments.TreatmentType.Crown && t.Status == DentalClinic.Domain.Treatments.TreatmentStatus.Completed && t.ClinicalWorkflowJson == null && t.ExecutedStepsJson == "[]") + implants.Count(i => ClinicalTimeline.ImplantEvents(i).Any(e => !e.PerformedAt.HasValue)) +
            endodontics.Count(r => !r.TreatmentId.HasValue || ClinicalTimeline.ParseFlow(r.WorkflowJson)?["flowVersion"]?.ToString() != "2") +
            treatments.Count(t => ClinicalTimeline.ParseFlow(t.ClinicalWorkflowJson)?["progress"] is System.Text.Json.Nodes.JsonObject progress && progress.Any(p => p.Value?["legacyImported"]?.ToString() == "true"));
        return new(first?.CreatedAt, firstEvent?.Date, firstEvent?.DayEn, firstEvent?.DayAr, firstEvent?.Time, zoneName,
            events.Skip((page - 1) * pageSize).Take(pageSize).ToArray(), page, pageSize, events.Length, uncertain);
    }
}
