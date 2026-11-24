
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.Worker;

public sealed partial class FixedExpenseHost(IServiceScopeFactory scopes, ILogger<FixedExpenseHost> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ExpenseObligationsService>()
                    .GenerateMonthlyAsync(null, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception error) { LogFailure(logger, error); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(EventId = 3300, Level = LogLevel.Error, Message = "Could not generate scheduled fixed expenses")]
    private static partial void LogFailure(ILogger logger, Exception error);
}
