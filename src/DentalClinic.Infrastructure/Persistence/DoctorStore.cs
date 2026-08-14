using System.Data;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class DoctorStore(ApplicationDbContext context) :
    IDoctorProfileStore, IDoctorScheduleStore, IDoctorCompensationStore
{
    public async Task<PagedResult<DoctorListItem>> SearchAsync(DoctorSearchQuery query, CancellationToken cancellationToken)
    {
        var doctors = context.DoctorProfiles.AsNoTracking();
        if (query.Status.HasValue) doctors = doctors.Where(x => x.Status == query.Status.Value);
        if (!string.IsNullOrWhiteSpace(query.Specialization))
            doctors = doctors.Where(x => EF.Functions.ILike(x.Specialization, $"%{query.Specialization}%"));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = $"%{query.Search}%";
            doctors = doctors.Where(x => EF.Functions.ILike(x.Specialization, term) ||
                context.ClinicUsers.Any(u => u.Id == x.ClinicUserId &&
                    (EF.Functions.ILike(u.DisplayName, term) ||
                     (u.Phone != null && EF.Functions.ILike(u.Phone, term)))) ||
                context.Users.Any(u => u.Id == x.ClinicUserId && u.Email != null && EF.Functions.ILike(u.Email, term)));
        }
        var total = await doctors.CountAsync(cancellationToken);
        var items = await (from doctor in doctors
                           join user in context.ClinicUsers.AsNoTracking() on doctor.ClinicUserId equals user.Id
                           join identity in context.Users.AsNoTracking() on doctor.ClinicUserId equals identity.Id
                           orderby user.DisplayName
                           select new DoctorListItem(doctor.Id, doctor.ClinicUserId, user.DisplayName,
                               identity.Email!, user.Phone, doctor.Specialization, doctor.LicenseNumber,
                               doctor.Status, doctor.CreatedAt))
            .Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        return new PagedResult<DoctorListItem>(items, query.Page, query.PageSize, total);
    }

    public async Task<DoctorProfileDetails?> GetDetailsAsync(Guid id, bool canManageSchedule,
        bool canManageCompensation, CancellationToken cancellationToken) =>
        await (from doctor in context.DoctorProfiles.AsNoTracking()
               join user in context.ClinicUsers.AsNoTracking() on doctor.ClinicUserId equals user.Id
               join identity in context.Users.AsNoTracking() on doctor.ClinicUserId equals identity.Id
               where doctor.Id == id
               select new DoctorProfileDetails(doctor.Id, doctor.ClinicUserId, user.DisplayName,
                   identity.Email!, user.Phone, user.Status, doctor.Specialization, doctor.LicenseNumber,
                   doctor.Bio, doctor.ConsultationDurationMinutes, doctor.Status, doctor.CreatedAt,
                   doctor.UpdatedAt, canManageSchedule, canManageCompensation)).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyCollection<DoctorCandidate>> GetCandidatesAsync(CancellationToken cancellationToken) =>
        await (from user in context.ClinicUsers.AsNoTracking()
               join identity in context.Users.AsNoTracking() on user.Id equals identity.Id
               where context.UserRoleAssignments.Any(a => a.UserId == user.Id &&
                   context.TenantRoles.Any(r => r.Id == a.RoleId && r.NormalizedName == "DOCTOR")) &&
                   !context.DoctorProfiles.Any(d => d.ClinicUserId == user.Id)
               orderby user.DisplayName
               select new DoctorCandidate(user.Id, user.DisplayName, identity.Email!, user.Phone))
            .ToListAsync(cancellationToken);

    public Task<DoctorProfile?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        context.DoctorProfiles.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    Task<DoctorProfile?> IDoctorScheduleStore.FindDoctorAsync(Guid id, CancellationToken cancellationToken) => FindAsync(id, cancellationToken);
    Task<DoctorProfile?> IDoctorCompensationStore.FindDoctorAsync(Guid id, CancellationToken cancellationToken) => FindAsync(id, cancellationToken);
    public Task<bool> IsDoctorUserAsync(Guid clinicUserId, CancellationToken cancellationToken) =>
        context.ClinicUsers.AnyAsync(x => x.Id == clinicUserId &&
            context.UserRoleAssignments.Any(a => a.UserId == clinicUserId &&
                context.TenantRoles.Any(r => r.Id == a.RoleId && r.NormalizedName == "DOCTOR")), cancellationToken);
    public Task<bool> ProfileExistsForUserAsync(Guid clinicUserId, CancellationToken cancellationToken) =>
        context.DoctorProfiles.AnyAsync(x => x.ClinicUserId == clinicUserId, cancellationToken);
    public Task<bool> LicenseExistsAsync(string licenseNumber, Guid? excludingId, CancellationToken cancellationToken) =>
        context.DoctorProfiles.AnyAsync(x => x.LicenseNumber == licenseNumber && (!excludingId.HasValue || x.Id != excludingId), cancellationToken);
    public void Add(DoctorProfile profile) => context.DoctorProfiles.Add(profile);

    public async Task<IDoctorTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        new DoctorTransaction(await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken));
    public async Task<IReadOnlyCollection<DoctorSchedule>> GetAsync(Guid doctorProfileId, bool tracking, CancellationToken cancellationToken)
    {
        var query = context.DoctorSchedules.Include(x => x.Breaks).Where(x => x.DoctorProfileId == doctorProfileId);
        if (!tracking) query = query.AsNoTracking();
        return await query.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).ToListAsync(cancellationToken);
    }
    public void AddRange(IEnumerable<DoctorSchedule> periods) => context.DoctorSchedules.AddRange(periods);
    public void RemoveRange(IEnumerable<DoctorSchedule> periods) => context.DoctorSchedules.RemoveRange(periods);

    public async Task<IReadOnlyCollection<DoctorCompensation>> GetHistoryAsync(Guid doctorProfileId, bool tracking, CancellationToken cancellationToken)
    {
        var query = context.DoctorCompensations.Where(x => x.DoctorProfileId == doctorProfileId);
        if (!tracking) query = query.AsNoTracking();
        return await query.OrderByDescending(x => x.EffectiveFrom).ToListAsync(cancellationToken);
    }
    public Task<bool> HasOverlapAsync(Guid doctorProfileId, DateOnly effectiveFrom, DateOnly? effectiveTo, Guid? excludingId,
        CancellationToken cancellationToken)
    {
        var upper = effectiveTo ?? DateOnly.MaxValue;
        return context.DoctorCompensations.AnyAsync(x => x.DoctorProfileId == doctorProfileId &&
            (!excludingId.HasValue || x.Id != excludingId.Value) && x.EffectiveFrom <= upper &&
            (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= effectiveFrom), cancellationToken);
    }
    public void Add(DoctorCompensation compensation) => context.DoctorCompensations.Add(compensation);

    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
