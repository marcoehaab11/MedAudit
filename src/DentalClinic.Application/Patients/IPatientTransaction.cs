namespace DentalClinic.Application.Patients;

public interface IPatientTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}
