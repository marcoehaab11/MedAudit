namespace DentalClinic.Application.Tenants;

public interface IPlatformTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}
