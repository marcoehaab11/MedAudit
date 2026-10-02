using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class DetailsModel(IClinicManagementService clinics, IPlatformUserInspectionService users) : PageModel
{
    public ClinicDetails Clinic { get; private set; } = null!;
    public PagedResult<UserListItem> Users { get; private set; } = null!;
    public DateTimeOffset Now { get; private set; }
    [TempData] public string? SuccessMessage { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, int userPage = 1, CancellationToken cancellationToken = default)
    {
        var clinic = await clinics.GetAsync(id, cancellationToken);
        if (clinic is null) return NotFound();
        Clinic = clinic;
        Users = await users.SearchAsync(id, new UserSearchQuery(Page: userPage, PageSize: 20), cancellationToken);
        Now = DateTimeOffset.UtcNow;
        return Page();
    }

    public async Task<IActionResult> OnPostStatusAsync(Guid id, TenantStatus status, CancellationToken cancellationToken)
    {
        if (!await clinics.ChangeStatusAsync(id, status, cancellationToken)) return NotFound();
        SuccessMessage = $"Clinic status changed to {status}.";
        return RedirectToPage(new { id });
    }

    public async Task<IActionResult> OnPostExtendAsync(Guid id, int months, CancellationToken cancellationToken)
    {
        if (months is < 1 or > 120)
        {
            ModelState.AddModelError("months", "Choose between 1 and 120 months.");
            return await OnGetAsync(id, cancellationToken: cancellationToken);
        }
        if (!await clinics.ExtendSubscriptionAsync(id, months, cancellationToken)) return NotFound();
        SuccessMessage = $"Subscription extended by {months} month(s).";
        return RedirectToPage(new { id });
    }

    public async Task<IActionResult> OnPostUserAccessAsync(Guid id, Guid userId, bool active, CancellationToken cancellationToken)
    {
        if (!await clinics.SetUserActiveAsync(id, userId, active, cancellationToken)) return NotFound();
        SuccessMessage = active ? "User access restored." : "User access disabled immediately.";
        return RedirectToPage(new { id });
    }
}
