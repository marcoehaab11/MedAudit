using DentalClinic.Application.Identity;
using DentalClinic.Domain.ClinicBusiness;
using DentalClinic.Domain.Inventory;
using DentalClinic.Infrastructure.Notifications;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DentalClinic.Worker;

public sealed partial class ClinicOperationsAlertHost(IServiceProvider services, ILogger<ClinicOperationsAlertHost> logger) : BackgroundService
{
    [LoggerMessage(EventId = 3200, Level = LogLevel.Error, Message = "Could not schedule clinic operation alerts")]
    private static partial void LogScheduleError(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 3201, Level = LogLevel.Warning, Message = "Could not queue clinic alert {EventType} for {EntityId}")]
    private static partial void LogAlertError(ILogger logger, string eventType, Guid entityId, Exception exception);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await QueueAlertsAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { LogScheduleError(logger, ex); }
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task QueueAlertsAsync(CancellationToken token)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        var day = now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var labs = await db.LabCases.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.DueAt <= now.AddDays(2) && x.Status != LabCaseStatus.Fitted &&
                x.Status != LabCaseStatus.Delivered && x.Status != LabCaseStatus.Cancelled)
            .OrderBy(x => x.DueAt)
            .Select(x => new { x.Id, x.TenantId, x.WorkType, x.DueAt }).ToListAsync(token);
        foreach (var item in labs)
            await TryAlert(db, item.TenantId, "LabDue", Permissions.LabView, "Laboratory case due",
                $"{item.WorkType} is due on {item.DueAt:yyyy-MM-dd HH:mm} UTC.",
                "LabCase", item.Id, $"lab-due:{item.Id:N}:{day}", token);

        var claims = await db.InsuranceClaims.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Status == InsuranceClaimStatus.ApprovalPending && x.UpdatedAt <= now.AddDays(-2))
            .OrderBy(x => x.UpdatedAt)
            .Select(x => new { x.Id, x.TenantId, x.RequestedAmount }).ToListAsync(token);
        foreach (var item in claims)
            await TryAlert(db, item.TenantId, "InsurancePending", Permissions.InsuranceView,
                "Insurance approval pending", $"Claim for {item.RequestedAmount:0.00} is still awaiting approval.",
                "InsuranceClaim", item.Id, $"insurance-pending:{item.Id:N}:{day}", token);

        var items = await db.InventoryItems.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.IsActive && x.MinimumStockLevel > 0).OrderBy(x => x.Id)
            .Select(x => new { x.Id, x.TenantId, x.Name, x.MinimumStockLevel }).ToListAsync(token);
        var ids = items.Select(x => x.Id).ToArray();
        var movements = await db.StockMovements.IgnoreQueryFilters().AsNoTracking()
            .Where(x => ids.Contains(x.ItemId))
            .Select(x => new { x.ItemId, x.MovementType, x.Quantity }).ToListAsync(token);
        var stock = movements.GroupBy(x => x.ItemId).ToDictionary(g => g.Key, g => g.Sum(x =>
            x.MovementType is StockMovementType.Issue or StockMovementType.AdjustmentDecrease ? -x.Quantity : x.Quantity));
        foreach (var item in items)
        {
            var quantity = stock.GetValueOrDefault(item.Id);
            if (quantity > item.MinimumStockLevel) continue;
            await TryAlert(db, item.TenantId, "LowStock", Permissions.InventoryView,
                "Low inventory stock", $"{item.Name}: {quantity:0.##} remaining (minimum {item.MinimumStockLevel:0.##}).",
                "InventoryItem", item.Id, $"low-stock:{item.Id:N}:{day}", token);
        }
    }

    private async Task TryAlert(ApplicationDbContext db, Guid tenantId, string eventType, string permission,
        string title, string body, string entityType, Guid entityId, string key, CancellationToken token)
    {
        try { await ClinicAlertDispatcher.EnqueueAsync(db, tenantId, eventType, permission, title, body, entityType, entityId, key, token); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogAlertError(logger, eventType, entityId, ex);
            db.ChangeTracker.Clear();
        }
    }
}
