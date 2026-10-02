using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Domain.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.PlatformAdmin.Pages;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public class IndexModel(IClinicManagementService clinics, ApplicationDbContext db) : PageModel
{
    public PagedResult<ClinicListItem> RecentClinics { get; private set; } = new([], 1, 6, 0);
    public int TotalClinics { get; private set; }
    public int ActiveClinics { get; private set; }
    public int SuspendedClinics { get; private set; }
    public int InactiveClinics { get; private set; }
    public string SystemStatus { get; private set; } = "Not configured";
    public int OpenClinicIssues { get; private set; }
    public string ClinicAppUrl { get; private set; } = string.Empty;
    public string BookingAppUrl { get; private set; } = string.Empty;
    public string ApiHealthUrl { get; private set; } = string.Empty;

    public async Task OnGetAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var host = Request.Host.Host;
        var baseHost = host.StartsWith("admin.", StringComparison.OrdinalIgnoreCase) ? host[6..] : host;
        var port = Request.Host.Port is { } p ? $":{p}" : string.Empty;
        ClinicAppUrl = $"{Request.Scheme}://app.{baseHost}{port}";
        BookingAppUrl = $"{Request.Scheme}://book.{baseHost}{port}";
        ApiHealthUrl = $"{Request.Scheme}://api.{baseHost}{port}/health/ready";
        var tenants = db.Tenants.AsNoTracking().IgnoreQueryFilters();
        TotalClinics = await tenants.CountAsync(cancellationToken);
        ActiveClinics = await tenants.CountAsync(x => x.Status == TenantStatus.Active, cancellationToken);
        SuspendedClinics = await tenants.CountAsync(x => x.Status == TenantStatus.Suspended, cancellationToken);
        InactiveClinics = await tenants.CountAsync(x => x.Status == TenantStatus.Inactive, cancellationToken);
        OpenClinicIssues = await tenants.CountAsync(x => x.Status == TenantStatus.Active && x.SubscriptionExpiresAt <= now, cancellationToken);
        var probes = await db.PlatformHealthProbes.AsNoTracking().ToListAsync(cancellationToken);
        SystemStatus = probes.Count == 0 ? "Not configured"
            : probes.Any(x => x.State == PlatformHealthState.Unhealthy) ? "Needs attention"
            : probes.Any(x => x.CheckedAt is null || x.CheckedAt < now.AddMinutes(-3)) ? "Checks stale"
            : "Healthy";

        RecentClinics = await clinics.SearchAsync(new ClinicSearchQuery(null, null, 1, 6), cancellationToken);
    }
}
