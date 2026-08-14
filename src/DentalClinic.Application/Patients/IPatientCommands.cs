namespace DentalClinic.Application.Patients;

public interface IPatientCommands
{
    Task<Guid> CreateAsync(CreatePatientCommand command, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(UpdatePatientCommand command, CancellationToken cancellationToken);
    Task<bool> ArchiveAsync(Guid patientId, CancellationToken cancellationToken);
}
