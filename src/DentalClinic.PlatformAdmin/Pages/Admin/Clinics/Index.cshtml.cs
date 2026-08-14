using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class IndexModel(IClinicManagementService clinics) : PageModel
{
    public PagedResult<ClinicListItem> Clinics { get; private set; } = new([], 1, 20, 0);
    [BindProperty(SupportsGet = true)] public string? Search { get; set; }
    [BindProperty(SupportsGet = true)] public TenantStatus? Status { get; set; }
    [BindProperty(SupportsGet = true)] public int PageNumber { get; set; } = 1;

    [TempData] public string? SuccessMessage { get; set; }

    public async Task OnGetAsync(CancellationToken cancellationToken) =>
        Clinics = await clinics.SearchAsync(
            new ClinicSearchQuery(Search, Status, PageNumber, 20), cancellationToken);

    public async Task<IActionResult> OnPostStatusAsync(
        Guid id,
        TenantStatus status,
        CancellationToken cancellationToken)
    {
        if (!await clinics.ChangeStatusAsync(id, status, cancellationToken))
        {
            return NotFound();
        }

        SuccessMessage = $"Clinic status changed to {status}.";
        return RedirectToPage(new { Search, Status, PageNumber });
    }
}
