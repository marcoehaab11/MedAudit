using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class DetailsModel(IClinicManagementService clinics) : PageModel
{
    public ClinicDetails Clinic { get; private set; } = null!;
    [TempData] public string? SuccessMessage { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken cancellationToken)
    {
        var clinic = await clinics.GetAsync(id, cancellationToken);
        if (clinic is null) return NotFound();
        Clinic = clinic;
        return Page();
    }

    public async Task<IActionResult> OnPostStatusAsync(Guid id, TenantStatus status, CancellationToken cancellationToken)
    {
        if (!await clinics.ChangeStatusAsync(id, status, cancellationToken)) return NotFound();
        SuccessMessage = $"Clinic status changed to {status}.";
        return RedirectToPage(new { id });
    }
}
