using DentalClinic.Domain.Appointments;
using DentalClinic.Infrastructure.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Worker;

public sealed partial class BookingReminderHost(IServiceProvider services, ILogger<BookingReminderHost> logger) : BackgroundService
{
    [LoggerMessage(EventId = 3100, Level = LogLevel.Error, Message = "Could not schedule booking reminders")]
    private static partial void LogScheduleError(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 3101, Level = LogLevel.Warning, Message = "Could not queue reminder for appointment {AppointmentId}")]
    private static partial void LogReminderError(ILogger logger, Guid appointmentId, Exception exception);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await QueueRemindersAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { LogScheduleError(logger, ex); }
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task QueueRemindersAsync(CancellationToken token)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        var rows = await (from booking in db.Appointments.IgnoreQueryFilters().AsNoTracking()
                          join patient in db.Patients.IgnoreQueryFilters().AsNoTracking() on booking.PatientId equals patient.Id
                          join tenant in db.Tenants.IgnoreQueryFilters().AsNoTracking() on booking.TenantId equals tenant.Id
                          join config in db.TenantConfigurations.IgnoreQueryFilters().AsNoTracking() on booking.TenantId equals config.TenantId
                          where booking.BookingReference != null && patient.Email != null && patient.Email != ""
                              && (booking.Status == AppointmentStatus.Scheduled || booking.Status == AppointmentStatus.Confirmed)
                              && booking.StartAt >= now.AddHours(1) && booking.StartAt <= now.AddHours(24)
                          select new { booking.Id, booking.TenantId, booking.PatientId, booking.StartAt,
                              booking.BookingReference, patient.Email, patient.FirstName, tenant.Name, config.TimeZone })
            .Take(500).ToListAsync(token);
        foreach (var row in rows)
        {
            var kind = row.StartAt <= now.AddHours(2) ? "2h" : "24h";
            var zone = TimeZoneInfo.FindSystemTimeZoneById(row.TimeZone);
            var localStart = TimeZoneInfo.ConvertTime(row.StartAt, zone);
            var body = $"Hello {row.FirstName},\nThis is a reminder for your appointment at {row.Name} on {localStart:yyyy-MM-dd HH:mm} ({row.TimeZone}).\nReference: {row.BookingReference}\nPlease contact the clinic if you need help.";
            try
            {
                await BookingEmailDispatcher.EnqueueAsync(db, row.TenantId, row.PatientId, row.Id, row.Email!,
                    $"BookingReminder{kind}", $"Appointment reminder: {row.Name}", body,
                    $"booking-reminder-{kind}:{row.Id:N}:{row.StartAt.ToUnixTimeSeconds()}", token);
            }
            catch (DbUpdateException ex)
            {
                LogReminderError(logger, row.Id, ex);
                db.ChangeTracker.Clear();
            }
        }
    }
}
