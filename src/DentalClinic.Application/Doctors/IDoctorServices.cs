using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Doctors;

public interface IDoctorProfileQueries
{
    Task<PagedResult<DoctorListItem>> SearchAsync(DoctorSearchQuery query, CancellationToken cancellationToken);
    Task<DoctorProfileDetails?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<DoctorCandidate>> GetCandidatesAsync(CancellationToken cancellationToken);
}
public interface IDoctorProfileCommands
{
    Task<Guid> CreateAsync(CreateDoctorProfileCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(UpdateDoctorProfileCommand command, CancellationToken cancellationToken);
    Task<bool> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<bool> ArchiveAsync(Guid id, CancellationToken cancellationToken);
}
public interface IDoctorScheduleService
{
    Task<IReadOnlyCollection<SchedulePeriodModel>?> GetAsync(Guid doctorProfileId, CancellationToken cancellationToken);
    Task<bool> SetAsync(Guid doctorProfileId, IReadOnlyCollection<SchedulePeriodInput> periods, CancellationToken cancellationToken);
}
public interface IDoctorCompensationService
{
    Task<IReadOnlyCollection<DoctorCompensationModel>?> GetHistoryAsync(Guid doctorProfileId, CancellationToken cancellationToken);
    Task<Guid?> CreateAsync(CreateDoctorCompensationCommand command, CancellationToken cancellationToken);
    Task<Guid?> UpdateAsync(UpdateDoctorCompensationCommand command, CancellationToken cancellationToken);
}
