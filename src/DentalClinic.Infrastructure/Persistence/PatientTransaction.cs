using DentalClinic.Application.Patients;
using Microsoft.EntityFrameworkCore.Storage;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PatientTransaction(IDbContextTransaction transaction) : IPatientTransaction
{
    public Task CommitAsync(CancellationToken cancellationToken) => transaction.CommitAsync(cancellationToken);
    public ValueTask DisposeAsync() => transaction.DisposeAsync();
}
