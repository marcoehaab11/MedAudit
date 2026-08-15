using DentalClinic.Application.Crm;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class CrmStore(ApplicationDbContext context) : ICrmStore
{
    public Task<string> GetTimeZoneAsync(CancellationToken token) => context.TenantConfigurations.AsNoTracking().Select(x => x.TimeZone).SingleAsync(token);
    public Task<CrmPatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmPatient(x.Id, x.Status, x.CreatedAt)).SingleOrDefaultAsync(token);
    public Task<CrmUser?> FindUserAsync(Guid id, CancellationToken token) => context.ClinicUsers.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmUser(x.Id, x.Status == UserStatus.Active)).SingleOrDefaultAsync(token);
    public Task<CrmRelation?> FindAppointmentAsync(Guid id, CancellationToken token) => context.Appointments.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmRelation(x.Id, x.PatientId)).SingleOrDefaultAsync(token);
    public Task<CrmRelation?> FindTreatmentPlanAsync(Guid id, CancellationToken token) => context.TreatmentPlans.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmRelation(x.Id, x.PatientId)).SingleOrDefaultAsync(token);
    public Task<CrmRelation?> FindTreatmentAsync(Guid id, CancellationToken token) => context.Treatments.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmRelation(x.Id, x.PatientId)).SingleOrDefaultAsync(token);
    public Task<CrmRelation?> FindPrescriptionAsync(Guid id, CancellationToken token) => context.Prescriptions.AsNoTracking().Where(x => x.Id == id).Select(x => new CrmRelation(x.Id, x.PatientId)).SingleOrDefaultAsync(token);
    public Task<FollowUp?> FindFollowUpAsync(Guid id, bool tracking, CancellationToken token) => (tracking ? context.FollowUps.AsQueryable() : context.FollowUps.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public Task<FollowUpDetails?> GetFollowUpAsync(Guid id, DateTimeOffset now, string zone, CancellationToken token) =>
        context.FollowUps.AsNoTracking().Where(x => x.Id == id).Select(x => new FollowUpDetails(x.Id, x.PatientId,
            context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(),
            x.AssignedToUserId, context.ClinicUsers.Where(u => u.Id == x.AssignedToUserId).Select(u => u.DisplayName).Single(),
            x.CreatedByUserId, x.Type, x.Status, x.DueAt,
            (x.Status == FollowUpStatus.Pending || x.Status == FollowUpStatus.InProgress) && x.DueAt < now,
            x.Title, x.Notes, x.RelatedAppointmentId, x.RelatedTreatmentPlanId, x.RelatedTreatmentId,
            x.RelatedPrescriptionId, x.CreatedAt, x.UpdatedAt, x.CompletedAt, x.CancelledAt, x.Version, zone)).SingleOrDefaultAsync(token);

    public async Task<PagedResult<FollowUpListItem>> SearchFollowUpsAsync(FollowUpStoreSearch x, CancellationToken token)
    {
        var query = context.FollowUps.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(x.Search)) query = query.Where(f => EF.Functions.ILike(f.Title, $"%{x.Search}%") || context.Patients.Any(p => p.Id == f.PatientId && (EF.Functions.ILike(p.FirstName, $"%{x.Search}%") || EF.Functions.ILike(p.LastName, $"%{x.Search}%"))));
        if (x.Status.HasValue) query = query.Where(f => f.Status == x.Status);
        if (x.Type.HasValue) query = query.Where(f => f.Type == x.Type);
        if (x.AssignedToUserId.HasValue) query = query.Where(f => f.AssignedToUserId == x.AssignedToUserId);
        if (x.PatientId.HasValue) query = query.Where(f => f.PatientId == x.PatientId);
        if (x.DueFrom.HasValue) query = query.Where(f => f.DueAt >= x.DueFrom);
        if (x.DueTo.HasValue) query = query.Where(f => f.DueAt < x.DueTo);
        if (x.Overdue.HasValue) query = x.Overdue.Value
            ? query.Where(f => (f.Status == FollowUpStatus.Pending || f.Status == FollowUpStatus.InProgress) && f.DueAt < x.Now)
            : query.Where(f => !((f.Status == FollowUpStatus.Pending || f.Status == FollowUpStatus.InProgress) && f.DueAt < x.Now));
        var total = await query.CountAsync(token);
        query = (x.SortBy, x.Descending) switch
        {
            (FollowUpSortField.CreatedAt, true) => query.OrderByDescending(f => f.CreatedAt),
            (FollowUpSortField.CreatedAt, false) => query.OrderBy(f => f.CreatedAt),
            (FollowUpSortField.Patient, true) => query.OrderByDescending(f => context.Patients.Where(p => p.Id == f.PatientId).Select(p => p.LastName).Single()),
            (FollowUpSortField.Patient, false) => query.OrderBy(f => context.Patients.Where(p => p.Id == f.PatientId).Select(p => p.LastName).Single()),
            (FollowUpSortField.Status, true) => query.OrderByDescending(f => f.Status),
            (FollowUpSortField.Status, false) => query.OrderBy(f => f.Status),
            (_, true) => query.OrderByDescending(f => f.DueAt),
            _ => query.OrderBy(f => f.DueAt)
        };
        var items = await query.Skip((x.Page - 1) * x.PageSize).Take(x.PageSize).Select(f => new FollowUpListItem(f.Id, f.PatientId,
            context.Patients.Where(p => p.Id == f.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(), f.AssignedToUserId,
            context.ClinicUsers.Where(u => u.Id == f.AssignedToUserId).Select(u => u.DisplayName).Single(), f.Type, f.Status, f.DueAt,
            (f.Status == FollowUpStatus.Pending || f.Status == FollowUpStatus.InProgress) && f.DueAt < x.Now,
            f.Title, f.CreatedAt, f.CompletedAt, f.Version, x.TimeZone)).ToListAsync(token);
        return new(items, total, x.Page, x.PageSize);
    }

    public async Task<CrmDashboard> GetDashboardAsync(DateTimeOffset today, DateTimeOffset tomorrow,
        DateTimeOffset week, DateTimeOffset month, DateTimeOffset now, string zone, CancellationToken token)
    {
        var newToday = await context.Patients.CountAsync(x => x.CreatedAt >= today && x.CreatedAt < tomorrow, token);
        var newWeek = await context.Patients.CountAsync(x => x.CreatedAt >= week && x.CreatedAt < tomorrow, token);
        var newMonth = await context.Patients.CountAsync(x => x.CreatedAt >= month && x.CreatedAt < tomorrow, token);
        var pending = await context.FollowUps.CountAsync(x => x.Status == FollowUpStatus.Pending, token);
        var overdue = await context.FollowUps.CountAsync(x => (x.Status == FollowUpStatus.Pending || x.Status == FollowUpStatus.InProgress) && x.DueAt < now, token);
        var completed = await context.FollowUps.CountAsync(x => x.Status == FollowUpStatus.Completed, token);
        var todayCount = await context.FollowUps.CountAsync(x => x.DueAt >= today && x.DueAt < tomorrow, token);
        return new(newToday, newWeek, newMonth, pending, overdue, completed, todayCount, zone);
    }

    public async Task<CrmPatientLifecycle?> GetPatientSummaryAsync(Guid patientId, DateTimeOffset newSince, DateTimeOffset now, string zone, CancellationToken token)
    {
        var patient = await context.Patients.AsNoTracking().Where(x => x.Id == patientId).Select(x => new { x.Id, x.Status, x.CreatedAt }).SingleOrDefaultAsync(token);
        if (patient is null) return null;
        var followups = await SearchFollowUpsAsync(new(null, null, null, null, patientId, null, null, null, now, zone, FollowUpSortField.CreatedAt, true, 1, 5), token);
        var pending = await context.FollowUps.CountAsync(x => x.PatientId == patientId && (x.Status == FollowUpStatus.Pending || x.Status == FollowUpStatus.InProgress), token);
        return new(patient.Id, patient.CreatedAt >= newSince, patient.Status, pending, followups.Items, await GetActivitiesAsync(patientId, 5, token), zone);
    }

    public async Task<IReadOnlyCollection<CommunicationActivityItem>> GetActivitiesAsync(Guid patientId, int take, CancellationToken token) =>
        await context.CommunicationActivities.AsNoTracking().Where(x => x.PatientId == patientId).OrderByDescending(x => x.OccurredAt).Take(take)
            .Select(x => new CommunicationActivityItem(x.Id, x.PatientId, context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(),
                x.UserId, context.ClinicUsers.Where(u => u.Id == x.UserId).Select(u => u.DisplayName).Single(), x.Type, x.Direction, x.Subject, x.Notes, x.OccurredAt, x.CreatedAt)).ToListAsync(token);
    public async Task<IReadOnlyCollection<CrmUserOption>> GetAssignableUsersAsync(CancellationToken token) => await context.ClinicUsers.AsNoTracking().Where(x => x.Status == UserStatus.Active).OrderBy(x => x.DisplayName).Select(x => new CrmUserOption(x.Id, x.DisplayName)).ToListAsync(token);
    public void AddFollowUp(FollowUp item) => context.FollowUps.Add(item);
    public void AddActivity(CommunicationActivity item) => context.CommunicationActivities.Add(item);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public async Task SaveChangesAsync(CancellationToken token) { try { await context.SaveChangesAsync(token); } catch (DbUpdateConcurrencyException) { throw new FollowUpConcurrencyException("The follow-up changed. Reload it before continuing."); } }
}
