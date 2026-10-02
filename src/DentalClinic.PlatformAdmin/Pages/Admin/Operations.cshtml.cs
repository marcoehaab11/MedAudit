using DentalClinic.Domain.Notifications;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.PlatformAdmin.Pages.Admin;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class OperationsModel(ApplicationDbContext db) : PageModel
{
    public sealed record ClinicIssue(Guid Id, string Name, string Reason);
    public IReadOnlyList<PlatformHealthProbe> Probes { get; private set; } = [];
    public IReadOnlyList<PlatformHealthEvent> Events { get; private set; } = [];
    public IReadOnlyList<ClinicIssue> ClinicIssues { get; private set; } = [];
    public DateTimeOffset Now { get; private set; }

    public async Task OnGetAsync(CancellationToken token)
    {
        Now = DateTimeOffset.UtcNow;
        Probes = await db.PlatformHealthProbes.AsNoTracking().OrderBy(x => x.Name).ToListAsync(token);
        Events = await db.PlatformHealthEvents.AsNoTracking().OrderByDescending(x => x.OccurredAt).Take(30).ToListAsync(token);

        var tenants = await db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Select(x => new { x.Id, x.Name, x.Status, x.SubscriptionExpiresAt })
            .ToListAsync(token);
        var failed = await db.NotificationDeliveries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.CreatedAt >= Now.AddHours(-24) && x.Status == NotificationStatus.Failed)
            .GroupBy(x => x.TenantId).Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, token);
        var oldInquiries = await db.BookingInquiries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.CreatedAt < Now.AddHours(-2) && x.Status == "New")
            .GroupBy(x => x.TenantId).Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, token);
        var oldBookings = await db.Appointments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.CreatedAt < Now.AddHours(-2) && x.BookingReference != null && x.PublicBookingContactedAt == null)
            .GroupBy(x => x.TenantId).Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, token);

        var issues = new List<ClinicIssue>();
        foreach (var tenant in tenants)
        {
            if (tenant.Status == TenantStatus.Active && tenant.SubscriptionExpiresAt <= Now)
                issues.Add(new(tenant.Id, tenant.Name, "Subscription expired; staff access is blocked"));
            if (tenant.Status == TenantStatus.Active && tenant.SubscriptionExpiresAt > Now && tenant.SubscriptionExpiresAt <= Now.AddDays(7))
                issues.Add(new(tenant.Id, tenant.Name, "Subscription expires within 7 days"));
            if (failed.TryGetValue(tenant.Id, out var failures))
                issues.Add(new(tenant.Id, tenant.Name, $"{failures} failed notification(s) in 24 hours"));
            var leads = oldInquiries.GetValueOrDefault(tenant.Id) + oldBookings.GetValueOrDefault(tenant.Id);
            if (leads > 0)
                issues.Add(new(tenant.Id, tenant.Name, $"{leads} booking lead(s) waiting over 2 hours"));
        }
        ClinicIssues = issues.Take(100).ToList();
    }
}
