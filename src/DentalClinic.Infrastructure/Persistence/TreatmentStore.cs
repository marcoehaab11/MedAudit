using DentalClinic.Application.Tenants.Models;
using DentalClinic.Application.Treatments;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class TreatmentStore(ApplicationDbContext context) : ITreatmentStore
{
    public Task<TreatmentPatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new TreatmentPatient(x.Id, x.FirstName + " " + x.LastName, x.Status == PatientStatus.Active)).SingleOrDefaultAsync(token);
    public Task<TreatmentDoctor?> FindDoctorAsync(Guid id, CancellationToken token) => context.DoctorProfiles.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new TreatmentDoctor(x.Id, x.ClinicUserId, context.ClinicUsers.Where(u => u.Id == x.ClinicUserId).Select(u => u.DisplayName).Single(), x.Status == DoctorProfileStatus.Active)).SingleOrDefaultAsync(token);
    public Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken token) => context.DoctorProfiles.AsNoTracking().Where(x => x.ClinicUserId == userId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(token);
    public Task<TreatmentAppointment?> FindAppointmentAsync(Guid id, CancellationToken token) => context.Appointments.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new TreatmentAppointment(x.Id, x.PatientId, x.DoctorProfileId)).SingleOrDefaultAsync(token);
    public Task<DentalProcedureReference?> FindDentalProcedureAsync(Guid id, CancellationToken token) => context.DentalProcedures.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new DentalProcedureReference(x.Id, x.PatientId, x.ToothNumber)).SingleOrDefaultAsync(token);
    public Task<TreatmentCatalogItem?> FindCatalogAsync(Guid id, bool tracking, CancellationToken token) =>
        (tracking ? context.TreatmentCatalogItems.AsQueryable() : context.TreatmentCatalogItems.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public async Task<IReadOnlyCollection<CatalogItemDetails>> GetCatalogAsync(bool includeInactive, CancellationToken token) => await context.TreatmentCatalogItems.AsNoTracking()
        .Where(x => includeInactive || x.IsActive).OrderBy(x => x.Name).Select(x => new CatalogItemDetails(x.Id, x.Type, x.Name, x.Code, x.Description, x.DefaultPrice, x.IsActive, x.CreatedAt, x.UpdatedAt)).ToListAsync(token);
    public Task<bool> CatalogCodeExistsAsync(string code, Guid? excludeId, CancellationToken token) => context.TreatmentCatalogItems.AnyAsync(x => x.Code == code && (!excludeId.HasValue || x.Id != excludeId), token);
    public Task<TreatmentPlan?> FindPlanAsync(Guid id, bool tracking, CancellationToken token)
    {
        var query = tracking ? context.TreatmentPlans.AsQueryable() : context.TreatmentPlans.AsNoTracking();
        return query.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, token);
    }
    public async Task<TreatmentPlanDetails?> GetPlanAsync(Guid id, Guid? visibleDoctorId, CancellationToken token)
    {
        var plan = await context.TreatmentPlans.AsNoTracking().Include(x => x.Items)
            .SingleOrDefaultAsync(x => x.Id == id && (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId), token);
        if (plan is null) return null;
        var patient = await context.Patients.AsNoTracking().Where(x => x.Id == plan.PatientId).Select(x => x.FirstName + " " + x.LastName).SingleAsync(token);
        var doctor = await DoctorName(plan.DoctorProfileId).SingleAsync(token);
        return new(plan.Id, plan.PatientId, patient, plan.DoctorProfileId, doctor, plan.Title, plan.Notes, plan.Status, plan.Subtotal, plan.DiscountAmount, plan.Total,
            plan.CreatedAt, plan.UpdatedAt, plan.ProposedAt, plan.AcceptedAt, plan.RejectedAt, plan.CompletedAt, plan.CancelledAt, plan.Version,
            plan.Items.OrderBy(x => x.CreatedAt).Select(x => new TreatmentPlanItemDetails(x.Id, x.TreatmentCatalogItemId, x.TreatmentType, x.TreatmentName, x.ToothNumber, x.Quantity, x.UnitPrice, x.DiscountAmount, x.Total, x.Notes, x.CreatedAt, x.UpdatedAt)).ToArray());
    }
    public async Task<PagedResult<TreatmentPlanListItem>> SearchPlansAsync(TreatmentPlanSearch request, Guid? visibleDoctorId, CancellationToken token)
    {
        var query = context.TreatmentPlans.AsNoTracking().Where(x => (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId) && (!request.PatientId.HasValue || x.PatientId == request.PatientId) && (!request.DoctorProfileId.HasValue || x.DoctorProfileId == request.DoctorProfileId) && (!request.Status.HasValue || x.Status == request.Status));
        if (request.From.HasValue) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(request.From.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (request.To.HasValue) query = query.Where(x => x.CreatedAt < new DateTimeOffset(request.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var count = await query.CountAsync(token);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(x => new TreatmentPlanListItem(x.Id, x.PatientId, context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(), x.DoctorProfileId,
                context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId).SelectMany(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName)).Single(), x.Title, x.Status, x.Total, x.CreatedAt)).ToListAsync(token);
        return new(items, request.Page, request.PageSize, count);
    }
    public Task<PlanExecutionSource?> FindPlanExecutionSourceAsync(Guid itemId, CancellationToken token) => context.TreatmentPlanItems.AsNoTracking().Where(i => i.Id == itemId)
        .Select(i => context.TreatmentPlans.Where(p => p.Id == i.TreatmentPlanId).Select(p => new PlanExecutionSource(p.Id, i.Id, p.PatientId, p.DoctorProfileId, i.TreatmentCatalogItemId, i.TreatmentType, i.TreatmentName, i.ToothNumber, i.Total, p.Status)).Single()).SingleOrDefaultAsync(token);
    public Task<Treatment?> FindTreatmentAsync(Guid id, bool tracking, CancellationToken token)
    {
        var query = tracking ? context.Treatments.AsQueryable() : context.Treatments.AsNoTracking(); return query.Include(x => x.Teeth).SingleOrDefaultAsync(x => x.Id == id, token);
    }
    public async Task<TreatmentDetails?> GetTreatmentAsync(Guid id, Guid? visibleDoctorId, CancellationToken token)
    {
        var value = await context.Treatments.AsNoTracking().Include(x => x.Teeth).SingleOrDefaultAsync(x => x.Id == id && (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId), token); if (value is null) return null;
        return new(value.Id, value.PatientId, await context.Patients.Where(x => x.Id == value.PatientId).Select(x => x.FirstName + " " + x.LastName).SingleAsync(token), value.DoctorProfileId,
            await DoctorName(value.DoctorProfileId).SingleAsync(token), value.AppointmentId, value.TreatmentPlanId, value.TreatmentPlanItemId, value.TreatmentCatalogItemId, value.SourceDentalProcedureId,
            value.Type, value.TreatmentName, value.Teeth.OrderBy(x => x.ToothNumber).Select(x => x.ToothNumber).ToArray(), value.Status, value.Price, value.Notes, value.StartedAt, value.CompletedAt, value.CreatedAt, value.UpdatedAt, value.Version);
    }
    public async Task<PagedResult<TreatmentListItem>> SearchTreatmentsAsync(TreatmentSearch request, Guid? visibleDoctorId, CancellationToken token)
    {
        var query = context.Treatments.AsNoTracking().Where(x => (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId) && (!request.PatientId.HasValue || x.PatientId == request.PatientId) && (!request.DoctorProfileId.HasValue || x.DoctorProfileId == request.DoctorProfileId) && (!request.Type.HasValue || x.Type == request.Type) && (!request.Status.HasValue || x.Status == request.Status) && (!request.ToothNumber.HasValue || x.Teeth.Any(t => t.ToothNumber == request.ToothNumber)));
        if (request.From.HasValue) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(request.From.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (request.To.HasValue) query = query.Where(x => x.CreatedAt < new DateTimeOffset(request.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var count = await query.CountAsync(token); var items = await query.OrderByDescending(x => x.CreatedAt).Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(x => new TreatmentListItem(x.Id, x.PatientId, context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(), x.DoctorProfileId,
                context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId).SelectMany(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName)).Single(), x.Type, x.TreatmentName,
                x.Teeth.OrderBy(t => t.ToothNumber).Select(t => t.ToothNumber).ToArray(), x.Status, x.Price, x.CreatedAt, x.CompletedAt)).ToListAsync(token);
        return new(items, request.Page, request.PageSize, count);
    }
    public void AddCatalog(TreatmentCatalogItem item) => context.TreatmentCatalogItems.Add(item);
    public void AddPlan(TreatmentPlan plan) => context.TreatmentPlans.Add(plan);
    public void AddTreatment(Treatment treatment) => context.Treatments.Add(treatment);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public async Task SaveChangesAsync(CancellationToken token)
    {
        try { await context.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { throw new TreatmentConcurrencyException("The treatment record changed. Reload it before continuing."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState is PostgresErrorCodes.UniqueViolation or PostgresErrorCodes.CheckViolation)
        { throw new TreatmentConcurrencyException("The treatment operation conflicts with persisted clinical data."); }
    }
    private IQueryable<string> DoctorName(Guid id) => context.DoctorProfiles.AsNoTracking().Where(x => x.Id == id)
        .SelectMany(x => context.ClinicUsers.Where(u => u.Id == x.ClinicUserId).Select(u => u.DisplayName));
}
