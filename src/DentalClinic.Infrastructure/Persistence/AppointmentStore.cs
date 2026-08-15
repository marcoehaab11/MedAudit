using DentalClinic.Application.Appointments;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class AppointmentStore(ApplicationDbContext context) : IAppointmentStore
{
    public Task<Patient?> FindPatientAsync(Guid id, CancellationToken cancellationToken) =>
        context.Patients.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<DoctorProfile?> FindDoctorAsync(Guid id, CancellationToken cancellationToken) =>
        context.DoctorProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken cancellationToken) =>
        context.DoctorProfiles.AsNoTracking().Where(x => x.ClinicUserId == userId)
            .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(cancellationToken);

    public Task<string> GetTenantTimeZoneAsync(CancellationToken cancellationToken) =>
        context.TenantConfigurations.AsNoTracking().Select(x => x.TimeZone).SingleAsync(cancellationToken);

    public async Task<IReadOnlyCollection<DoctorSchedule>> GetScheduleAsync(
        Guid doctorProfileId, CancellationToken cancellationToken) =>
        await context.DoctorSchedules.AsNoTracking().Include(x => x.Breaks)
            .Where(x => x.DoctorProfileId == doctorProfileId).ToListAsync(cancellationToken);

    public async Task<IReadOnlyCollection<AppointmentBusyPeriod>> GetBusyPeriodsAsync(Guid doctorProfileId,
        DateTimeOffset rangeStart, DateTimeOffset rangeEnd, Guid? excludeAppointmentId, CancellationToken cancellationToken) =>
        await context.Appointments.AsNoTracking()
            .Where(x => x.DoctorProfileId == doctorProfileId && x.Status != AppointmentStatus.Cancelled &&
                x.StartAt < rangeEnd && x.EndAt > rangeStart && (!excludeAppointmentId.HasValue || x.Id != excludeAppointmentId))
            .Select(x => new AppointmentBusyPeriod(x.StartAt, x.EndAt)).ToListAsync(cancellationToken);

    public Task<bool> HasConflictAsync(Guid doctorProfileId, Guid patientId, DateTimeOffset startAt,
        DateTimeOffset endAt, Guid? excludeAppointmentId, CancellationToken cancellationToken) =>
        context.Appointments.AsNoTracking().AnyAsync(x => x.Status != AppointmentStatus.Cancelled &&
            (x.DoctorProfileId == doctorProfileId || x.PatientId == patientId) && x.StartAt < endAt && x.EndAt > startAt &&
            (!excludeAppointmentId.HasValue || x.Id != excludeAppointmentId), cancellationToken);

    public Task<Appointment?> FindAsync(Guid id, bool tracking, CancellationToken cancellationToken)
    {
        var query = tracking ? context.Appointments.AsQueryable() : context.Appointments.AsNoTracking();
        return query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public Task<AppointmentDetails?> GetDetailsAsync(
        Guid id, Guid? visibleDoctorProfileId, CancellationToken cancellationToken) =>
        DetailsQuery(visibleDoctorProfileId, id).SingleOrDefaultAsync(cancellationToken);

    public async Task<PagedResult<AppointmentListItem>> SearchAsync(AppointmentSearchQuery query,
        DateTimeOffset rangeStart, DateTimeOffset rangeEnd, Guid? visibleDoctorProfileId, string timeZone,
        CancellationToken cancellationToken)
    {
        var appointments = context.Appointments.AsNoTracking().Where(x => x.StartAt < rangeEnd && x.EndAt > rangeStart);
        if (visibleDoctorProfileId.HasValue) appointments = appointments.Where(x => x.DoctorProfileId == visibleDoctorProfileId);
        if (query.DoctorProfileId.HasValue) appointments = appointments.Where(x => x.DoctorProfileId == query.DoctorProfileId);
        if (query.PatientId.HasValue) appointments = appointments.Where(x => x.PatientId == query.PatientId);
        if (query.Status.HasValue) appointments = appointments.Where(x => x.Status == query.Status);
        if (query.Type.HasValue) appointments = appointments.Where(x => x.Type == query.Type);
        var total = await appointments.CountAsync(cancellationToken);
        var items = await appointments.OrderBy(x => x.StartAt).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(x => new AppointmentListItem(x.Id, x.PatientId,
                context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(),
                x.DoctorProfileId,
                context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId)
                    .Select(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName).Single()).Single(),
                x.Type, x.Status, x.StartAt, x.EndAt, x.DurationMinutes, timeZone))
            .ToListAsync(cancellationToken);
        return new PagedResult<AppointmentListItem>(items, total, query.Page, query.PageSize);
    }

    public void Add(Appointment appointment) => context.Appointments.Add(appointment);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException postgres &&
            postgres.SqlState is PostgresErrorCodes.ExclusionViolation or PostgresErrorCodes.DeadlockDetected)
        {
            throw new AppointmentConflictException("The selected doctor or patient is no longer available for this time.");
        }
    }

    private IQueryable<AppointmentDetails> DetailsQuery(Guid? visibleDoctorProfileId, Guid appointmentId)
    {
        var appointments = context.Appointments.AsNoTracking().Where(x => x.Id == appointmentId);
        if (visibleDoctorProfileId.HasValue) appointments = appointments.Where(x => x.DoctorProfileId == visibleDoctorProfileId);
        return appointments.Select(x => new AppointmentDetails(x.Id, x.PatientId,
            context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(),
            x.DoctorProfileId,
            context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId)
                .Select(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName).Single()).Single(),
            x.Type, x.Status, x.StartAt, x.EndAt, x.DurationMinutes, x.Notes, x.CancellationReason,
            x.CreatedAt, x.UpdatedAt, x.ConfirmedAt, x.CheckedInAt, x.CompletedAt, x.CancelledAt,
            context.TenantConfigurations.Select(c => c.TimeZone).Single()));
    }
}
