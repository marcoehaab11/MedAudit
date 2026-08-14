using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Doctors;

internal sealed class DoctorProfileQueries(IDoctorProfileStore store, IPermissionService permissions) : IDoctorProfileQueries
{
    public async Task<PagedResult<DoctorListItem>> SearchAsync(DoctorSearchQuery query, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsView, cancellationToken);
        return await store.SearchAsync(query with
        {
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, 100),
            Search = query.Search?.Trim(),
            Specialization = query.Specialization?.Trim()
        }, cancellationToken);
    }

    public async Task<DoctorProfileDetails?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsView, cancellationToken);
        var canSchedule = await permissions.HasPermissionAsync(Permissions.DoctorsManageSchedule, cancellationToken);
        var canCompensation = await permissions.HasPermissionAsync(Permissions.DoctorsManageCompensation, cancellationToken);
        return await store.GetDetailsAsync(id, canSchedule, canCompensation, cancellationToken);
    }

    public async Task<IReadOnlyCollection<DoctorCandidate>> GetCandidatesAsync(CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsCreate, cancellationToken);
        return await store.GetCandidatesAsync(cancellationToken);
    }
}
