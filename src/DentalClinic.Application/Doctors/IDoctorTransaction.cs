namespace DentalClinic.Application.Doctors;

public interface IDoctorTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}
