using DentalClinic.Application.Dental;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class DentalStore(ApplicationDbContext context) : IDentalStore
{
    public Task<DentalPatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking()
        .Where(x => x.Id == id).Select(x => new DentalPatient(x.Id, x.FirstName + " " + x.LastName,
            x.PatientNumber, x.Status == PatientStatus.Active)).SingleOrDefaultAsync(token);

    public Task<ClinicalAppointment?> FindAppointmentAsync(Guid id, CancellationToken token) => context.Appointments.AsNoTracking()
        .Where(x => x.Id == id).Select(x => new ClinicalAppointment(x.Id, x.PatientId, x.DoctorProfileId,
            context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId).Select(d => d.ClinicUserId).Single(), x.Status))
        .SingleOrDefaultAsync(token);
    public Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken token) => context.DoctorProfiles.AsNoTracking()
        .Where(x => x.ClinicUserId == userId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(token);
    public Task<bool> ExaminationExistsForAppointmentAsync(Guid appointmentId, CancellationToken token) =>
        context.Examinations.AnyAsync(x => x.AppointmentId == appointmentId, token);
    public Task<Guid?> FindExaminationIdByAppointmentAsync(Guid appointmentId, CancellationToken token) =>
        context.Examinations.AsNoTracking().Where(x => x.AppointmentId == appointmentId)
            .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(token);
    public Task<Examination?> FindExaminationAsync(Guid id, bool tracking, CancellationToken token)
    {
        var query = tracking ? context.Examinations.AsQueryable() : context.Examinations.AsNoTracking();
        return query.Include(x => x.Findings).ThenInclude(x => x.Surfaces)
            .Include(x => x.Procedures).ThenInclude(x => x.Surfaces)
            .Include(x => x.EndodonticRecords).ThenInclude(x => x.Canals)
            .SingleOrDefaultAsync(x => x.Id == id, token);
    }
    public async Task<ExaminationDetails?> GetExaminationAsync(Guid id, CancellationToken token)
    {
        var examination = await FindExaminationAsync(id, false, token); if (examination is null) return null;
        var patient = await context.Patients.AsNoTracking().Where(x => x.Id == examination.PatientId)
            .Select(x => new { Name = x.FirstName + " " + x.LastName, x.PatientNumber }).SingleAsync(token);
        var doctor = await context.ClinicUsers.AsNoTracking().Where(x => x.Id == examination.DoctorUserId)
            .Select(x => x.DisplayName).SingleAsync(token);
        var appointmentStatus = await context.Appointments.AsNoTracking().Where(x => x.Id == examination.AppointmentId)
            .Select(x => x.Status).SingleAsync(token);
        return new ExaminationDetails(examination.Id, examination.PatientId, patient.Name, patient.PatientNumber,
            examination.AppointmentId, appointmentStatus, examination.DoctorUserId, doctor, examination.Status,
            examination.Notes, examination.CreatedAt, examination.UpdatedAt, examination.CompletedAt, examination.Version,
            examination.Status == ExaminationStatus.Draft, examination.Status == ExaminationStatus.Draft,
            examination.Findings.OrderBy(x => x.CreatedAt).Select(Map).ToArray(),
            examination.Procedures.OrderBy(x => x.CreatedAt).Select(Map).ToArray(),
            examination.EndodonticRecords.OrderBy(x => x.CreatedAt).Select(Map).ToArray());
    }
    public async Task<PatientDentalChart?> GetChartAsync(Guid patientId, CancellationToken token)
    {
        var patient = await FindPatientAsync(patientId, token); if (patient is null) return null;
        var findings = await context.DentalFindings.AsNoTracking()
            .Where(x => x.PatientId == patientId && context.Examinations.Any(e => e.Id == x.ExaminationId && e.Status == ExaminationStatus.Completed))
            .Select(x => new { x.ToothNumber, x.ToothId, x.FindingType, x.CreatedAt }).ToListAsync(token);
        var procedures = await context.DentalProcedures.AsNoTracking()
            .Where(x => x.PatientId == patientId && context.Examinations.Any(e => e.Id == x.ExaminationId && e.Status == ExaminationStatus.Completed))
            .Select(x => new { x.ToothNumber, x.ToothId, x.ProcedureType, x.CreatedAt }).ToListAsync(token);
        var endodontic = await context.EndodonticRecords.AsNoTracking()
            .Where(x => x.PatientId == patientId && context.Examinations.Any(e => e.Id == x.ExaminationId && e.Status == ExaminationStatus.Completed))
            .Select(x => new { x.ToothNumber, x.CreatedAt }).ToListAsync(token);
        var teeth = PermanentToothCatalog.All.Select(tooth => new ToothChartSummary(tooth.Id, tooth.Number,
            findings.Where(x => x.ToothNumber == tooth.Number).OrderByDescending(x => x.CreatedAt).Select(x => x.FindingType).Distinct().ToArray(),
            procedures.Where(x => x.ToothNumber == tooth.Number).OrderByDescending(x => x.CreatedAt).Select(x => x.ProcedureType).Distinct().ToArray(),
            endodontic.Any(x => x.ToothNumber == tooth.Number),
            findings.Where(x => x.ToothNumber == tooth.Number).Select(x => (DateTimeOffset?)x.CreatedAt)
                .Concat(procedures.Where(x => x.ToothNumber == tooth.Number).Select(x => (DateTimeOffset?)x.CreatedAt))
                .Concat(endodontic.Where(x => x.ToothNumber == tooth.Number).Select(x => (DateTimeOffset?)x.CreatedAt)).Max()))
            .ToArray();
        return new PatientDentalChart(patient.Id, patient.Name, patient.PatientNumber, teeth,
            await GetHistoryAsync(patientId, 10, token));
    }
    public async Task<IReadOnlyCollection<ExaminationHistoryItem>> GetHistoryAsync(Guid patientId, int take, CancellationToken token) =>
        await context.Examinations.AsNoTracking().Where(x => x.PatientId == patientId).OrderByDescending(x => x.CreatedAt).Take(take)
            .Select(x => new ExaminationHistoryItem(x.Id, x.AppointmentId, x.Status,
                context.ClinicUsers.Where(u => u.Id == x.DoctorUserId).Select(u => u.DisplayName).Single(), x.CreatedAt, x.CompletedAt))
            .ToListAsync(token);
    public void Add(Examination examination) => context.Examinations.Add(examination);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public async Task SaveChangesAsync(CancellationToken token)
    {
        try { await context.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { throw new DentalConcurrencyException("The examination changed. Reload it before continuing."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState == PostgresErrorCodes.UniqueViolation)
        { throw new DentalConcurrencyException("The clinical record conflicts with a newer change."); }
    }
    private static DentalFindingDetails Map(DentalFinding x) => new(x.Id, x.ToothId, x.ToothNumber, x.FindingType,
        x.Surfaces.Select(s => s.Surface).ToArray(), x.Notes, x.CreatedAt, x.CreatedBy);
    private static DentalProcedureDetails Map(DentalProcedure x) => new(x.Id, x.ToothId, x.ToothNumber, x.ProcedureType,
        x.Surfaces.Select(s => s.Surface).ToArray(), x.Notes, x.CreatedAt, x.CreatedBy);
    private static EndodonticDetails Map(EndodonticRecord x) => new(x.Id, x.ToothId, x.ToothNumber, x.Notes,
        x.Canals.Select(c => new EndodonticCanalDetails(c.Id, c.Name, c.LengthMm, c.Notes)).ToArray(), x.CreatedAt, x.CreatedBy);
}
