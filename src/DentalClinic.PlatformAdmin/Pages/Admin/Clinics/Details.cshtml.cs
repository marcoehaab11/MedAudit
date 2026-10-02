using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using QRCoder;
using System.Text;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class DetailsModel(IClinicManagementService clinics, IPlatformUserInspectionService users, ApplicationDbContext db) : PageModel
{
    public sealed record UsageStats(int Patients, int Appointments, int OnlineBookings, int BookingInquiries,
        int PageVisits, int FailedNotifications, int UncontactedLeads, DateTimeOffset? LastActivity);
    public UsageStats Usage { get; private set; } = new(0, 0, 0, 0, 0, 0, 0, null);
    public ClinicDetails Clinic { get; private set; } = null!;
    public PagedResult<UserListItem> Users { get; private set; } = null!;
    public DateTimeOffset Now { get; private set; }
    public string BookingUrl { get; private set; } = string.Empty;
    public string ClinicAppUrl { get; private set; } = string.Empty;
    public string BookingQrDataUri { get; private set; } = string.Empty;
    [TempData] public string? SuccessMessage { get; set; }

    public async Task<IActionResult> OnGetAsync(Guid id, int userPage = 1, CancellationToken cancellationToken = default)
    {
        var clinic = await clinics.GetAsync(id, cancellationToken);
        if (clinic is null) return NotFound();
        Clinic = clinic;
        Users = await users.SearchAsync(id, new UserSearchQuery(Page: userPage, PageSize: 20), cancellationToken);
        Now = DateTimeOffset.UtcNow;
        var since = Now.AddDays(-30);
        var appointments = db.Appointments.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == id);
        var inquiries = db.BookingInquiries.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == id);
        Usage = new UsageStats(
            await db.Patients.IgnoreQueryFilters().CountAsync(x => x.TenantId == id && x.CreatedAt >= since, cancellationToken),
            await appointments.CountAsync(x => x.CreatedAt >= since, cancellationToken),
            await appointments.CountAsync(x => x.CreatedAt >= since && x.BookingReference != null, cancellationToken),
            await inquiries.CountAsync(x => x.CreatedAt >= since, cancellationToken),
            await db.BookingPageVisits.IgnoreQueryFilters().CountAsync(x => x.TenantId == id && x.CreatedAt >= since, cancellationToken),
            await db.NotificationDeliveries.IgnoreQueryFilters().CountAsync(x => x.TenantId == id && x.CreatedAt >= since && x.Status == NotificationStatus.Failed, cancellationToken),
            await inquiries.CountAsync(x => x.Status == "New" && x.CreatedAt < Now.AddHours(-2), cancellationToken)
                + await appointments.CountAsync(x => x.BookingReference != null && x.PublicBookingContactedAt == null && x.CreatedAt < Now.AddHours(-2), cancellationToken),
            await appointments.MaxAsync(x => (DateTimeOffset?)x.CreatedAt, cancellationToken));
        var host = Request.Host.Host;
        var baseHost = host.StartsWith("admin.", StringComparison.OrdinalIgnoreCase) ? host[6..] : host;
        var publicHost = baseHost.StartsWith("book.", StringComparison.OrdinalIgnoreCase) ? baseHost : $"book.{baseHost}";
        var portSuffix = Request.Host.Port is { } port ? $":{port}" : string.Empty;
        ClinicAppUrl = $"{Request.Scheme}://app.{baseHost}{portSuffix}";
        BookingUrl = $"{Request.Scheme}://{publicHost}{portSuffix}/book/{Uri.EscapeDataString(clinic.Slug)}";
        using var data = QRCodeGenerator.GenerateQrCode(BookingUrl, QRCodeGenerator.ECCLevel.Q);
        using var qr = new SvgQRCode(data);
        BookingQrDataUri = "data:image/svg+xml;base64," + Convert.ToBase64String(Encoding.UTF8.GetBytes(qr.GetGraphic(6)));
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
