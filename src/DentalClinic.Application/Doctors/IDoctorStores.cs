using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Doctors;

public interface IDoctorProfileStore
{
    Task<PagedResult<DoctorListItem>> SearchAsync(DoctorSearchQuery query, CancellationToken cancellationToken);
    Task<DoctorProfileDetails?> GetDetailsAsync(Guid id, bool canManageSchedule, bool canManageCompensation, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<DoctorCandidate>> GetCandidatesAsync(CancellationToken cancellationToken);
    Task<DoctorProfile?> FindAsync(Guid id, CancellationToken cancellationToken);
    Task<DoctorProfile?> FindByUserIdAsync(Guid clinicUserId, CancellationToken cancellationToken);
    Task<bool> IsDoctorUserAsync(Guid clinicUserId, CancellationToken cancellationToken);
    Task<bool> ProfileExistsForUserAsync(Guid clinicUserId, CancellationToken cancellationToken);
    Task<bool> LicenseExistsAsync(string licenseNumber, Guid? excludingId, CancellationToken cancellationToken);
    void Add(DoctorProfile profile);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public interface IDoctorScheduleStore
{
    Task<IDoctorTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    Task<DoctorProfile?> FindDoctorAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<DoctorSchedule>> GetAsync(Guid doctorProfileId, bool tracking, CancellationToken cancellationToken);
    void AddRange(IEnumerable<DoctorSchedule> periods);
    void RemoveRange(IEnumerable<DoctorSchedule> periods);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public interface IDoctorCompensationStore
{
    Task<IDoctorTransaction> BeginTransactionAsync(CancellationToken cancellationToken);
    Task<DoctorProfile?> FindDoctorAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<DoctorCompensation>> GetHistoryAsync(Guid doctorProfileId, bool tracking, CancellationToken cancellationToken);
    Task<bool> HasOverlapAsync(Guid doctorProfileId, DateOnly effectiveFrom, DateOnly? effectiveTo, Guid? excludingId, CancellationToken cancellationToken);
    void Add(DoctorCompensation compensation);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
