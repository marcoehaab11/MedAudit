using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.PlatformAdmin.Pages.Admin;

public sealed class RegistrationsModel(ApplicationDbContext db) : PageModel
{
    public IReadOnlyList<ClinicRegistration> Registrations { get; private set; } = [];
    public IReadOnlyList<Tenant> Clinics { get; private set; } = [];
    public DateTimeOffset Now => DateTimeOffset.UtcNow;
    [TempData] public string? Message { get; set; }
    public async Task OnGetAsync(CancellationToken token)
    {
        Registrations = await db.ClinicRegistrations.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(200).ToArrayAsync(token);
        Clinics = await db.Tenants.AsNoTracking().Where(x => x.ParentClinicId == null).OrderByDescending(x => x.CreatedAt).Take(200).ToArrayAsync(token);
    }

    public async Task<IActionResult> OnGetLogoAsync(Guid id, CancellationToken token)
    {
        var registration = await db.ClinicRegistrations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token);
        return registration?.Logo is null || registration.LogoContentType is null ? NotFound() : File(registration.Logo, registration.LogoContentType);
    }

    public async Task<IActionResult> OnPostShowcaseAsync(Guid id, bool consent, bool published, int order, CancellationToken token)
    {
        var clinic = await db.Tenants.SingleOrDefaultAsync(x => x.Id == id && x.ParentClinicId == null, token);
        if (clinic is null) return NotFound();
        if (published && !consent) { Message = "Obtain the clinic's consent before publishing its name and logo."; return RedirectToPage(); }
        clinic.SetShowcase(consent, published, order);
        await db.SaveChangesAsync(token);
        Message = "Customer section updated. Only approved, consenting and active clinics appear publicly.";
        return RedirectToPage();
    }
}
