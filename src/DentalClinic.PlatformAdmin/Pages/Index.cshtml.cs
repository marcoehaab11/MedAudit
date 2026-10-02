using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public class IndexModel(IClinicManagementService clinics) : PageModel
{
    public PagedResult<ClinicListItem> RecentClinics { get; private set; } = new([], 1, 6, 0);
    public int TotalClinics { get; private set; }
    public int ActiveClinics { get; private set; }
    public int SuspendedClinics { get; private set; }
    public int InactiveClinics { get; private set; }

    public async Task OnGetAsync(CancellationToken cancellationToken)
    {
        var allResult = await clinics.SearchAsync(new ClinicSearchQuery(null, null, 1, 100), cancellationToken);
        TotalClinics = allResult.TotalCount;
        ActiveClinics = allResult.Items.Count(c => c.Status == TenantStatus.Active);
        SuspendedClinics = allResult.Items.Count(c => c.Status == TenantStatus.Suspended);
        InactiveClinics = allResult.Items.Count(c => c.Status == TenantStatus.Inactive);

        RecentClinics = await clinics.SearchAsync(new ClinicSearchQuery(null, null, 1, 6), cancellationToken);
    }
}
