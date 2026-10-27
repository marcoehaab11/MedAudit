using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DentalClinic.Infrastructure.Persistence;

public sealed class DatabaseSecurityInterceptor(DatabaseSecurityContext security) : DbCommandInterceptor
{
    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    { security.Apply(command.Connection!, command.Transaction); return result; }
    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    { await security.ApplyAsync(command.Connection!, command.Transaction, cancellationToken); return result; }
    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    { security.Apply(command.Connection!, command.Transaction); return result; }
    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    { await security.ApplyAsync(command.Connection!, command.Transaction, cancellationToken); return result; }
    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    { security.Apply(command.Connection!, command.Transaction); return result; }
    public override async ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<object> result, CancellationToken cancellationToken = default)
    { await security.ApplyAsync(command.Connection!, command.Transaction, cancellationToken); return result; }
}
