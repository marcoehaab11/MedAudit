using DentalClinic.Application.Tenants.Models;

namespace DentalClinic.Application.Patients;

public interface IPatientQueries
{
    Task<PagedResult<PatientListItem>> SearchAsync(PatientSearchQuery query, CancellationToken cancellationToken);
    Task<PatientDetails?> GetAsync(Guid patientId, CancellationToken cancellationToken);
}
