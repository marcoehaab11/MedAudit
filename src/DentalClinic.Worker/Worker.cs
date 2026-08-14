namespace DentalClinic.Worker;

public sealed class Worker(ILogger<Worker> logger) : BackgroundService
{
    private static readonly Action<ILogger, Exception?> LogStarted =
        LoggerMessage.Define(LogLevel.Information, new EventId(2000, "WorkerStarted"),
            "Dental Clinic background worker started");

    private static readonly Action<ILogger, Exception?> LogStopped =
        LoggerMessage.Define(LogLevel.Information, new EventId(2001, "WorkerStopped"),
            "Dental Clinic background worker stopped");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogStarted(logger, null);

        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            LogStopped(logger, null);
        }
    }
}
