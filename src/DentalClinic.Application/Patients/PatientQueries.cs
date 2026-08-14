using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.Patients;

internal sealed class PatientQueries(IPatientStore store, IPermissionService permissions) : IPatientQueries
{
    public async Task<PagedResult<PatientListItem>> SearchAsync(
        PatientSearchQuery query,
        CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsView, cancellationToken);
        if (query.RegisteredFrom.HasValue && query.RegisteredTo.HasValue && query.RegisteredFrom > query.RegisteredTo)
            throw PatientValidation.Error("RegisteredTo", "Registration end date must be on or after the start date.");
        var normalized = query with
        {
            Status = query.Status ?? PatientStatus.Active,
            Page = Math.Max(1, query.Page),
            PageSize = Math.Clamp(query.PageSize, 1, 100),
            SortBy = Enum.IsDefined(query.SortBy) ? query.SortBy : PatientSortField.CreatedAt
        };
        return await store.SearchAsync(normalized, cancellationToken);
    }

    public async Task<PatientDetails?> GetAsync(Guid patientId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.PatientsView, cancellationToken);
        var canViewMedical = await permissions.HasPermissionAsync(
            Permissions.PatientsViewMedicalHistory, cancellationToken);
        var canEditMedical = canViewMedical && await permissions.HasPermissionAsync(
            Permissions.PatientsEditMedicalHistory, cancellationToken);
        return await store.GetDetailsAsync(patientId, canViewMedical, canEditMedical, cancellationToken);
    }
}
