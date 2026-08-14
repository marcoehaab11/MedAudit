using DentalClinic.Application.Tenants;
using Microsoft.EntityFrameworkCore.Storage;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PlatformTransaction(IDbContextTransaction transaction) : IPlatformTransaction
{
    public Task CommitAsync(CancellationToken cancellationToken) => transaction.CommitAsync(cancellationToken);
    public ValueTask DisposeAsync() => transaction.DisposeAsync();
}
