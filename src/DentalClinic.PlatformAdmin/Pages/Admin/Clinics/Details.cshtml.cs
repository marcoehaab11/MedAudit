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
using System.Security.Cryptography;
using System.Text.Json;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
[RequestFormLimits(MultipartBodyLengthLimit = 2_147_483_647)]
[RequestSizeLimit(2_147_483_647)]
public sealed partial class DetailsModel(IClinicManagementService clinics, IPlatformUserInspectionService users, ApplicationDbContext db, ClinicBackupService backups, ILogger<DetailsModel> logger) : PageModel
{
    [LoggerMessage(EventId = 510, Level = LogLevel.Warning, Message = "Platform administrator exported backup for clinic {ClinicId}")]
    private partial void BackupExported(Guid clinicId);
    [LoggerMessage(EventId = 511, Level = LogLevel.Warning, Message = "Platform administrator restored clinic {ClinicId} from backup created {BackupCreatedAt} with modules {Modules}")]
    private partial void BackupRestored(Guid clinicId, DateTimeOffset backupCreatedAt, string modules);
    [LoggerMessage(EventId = 512, Level = LogLevel.Warning, Message = "Clinic {ClinicId} restore rejected")]
    private partial void RestoreRejected(Exception exception, Guid clinicId);
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
    [TempData] public string? BackupErrorMessage { get; set; }
    public IReadOnlyList<BackupModule> BackupModules => ClinicBackupService.Modules;

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

    public async Task<IActionResult> OnPostBackupAsync(Guid id, string password, CancellationToken cancellationToken)
    {
        if (!await db.Tenants.AnyAsync(x => x.Id == id, cancellationToken)) return NotFound();
        try
        {
            var backup = await backups.ExportAsync(id, ["all"], password, cancellationToken);
            BackupExported(id);
            return File(backup.Stream, "application/octet-stream", backup.Name);
        }
        catch (ArgumentException ex)
        {
            BackupErrorMessage = ex.Message;
            return RedirectToPage(new { id });
        }
    }

    public async Task<IActionResult> OnPostPreviewRestoreAsync(Guid id, IFormFile file, string password, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0) return BadRequest(new { error = "Select a backup file." });
        try
        {
            var manifest = await backups.InspectAsync(file.OpenReadStream(), password, id, cancellationToken);
            return new JsonResult(new { manifest.ClinicName, manifest.CreatedAt, manifest.Modules, tables = manifest.Tables.Length, rows = manifest.Tables.Sum(x => x.Rows) });
        }
        catch (Exception ex) when (ex is InvalidDataException or CryptographicException or ArgumentException or InvalidOperationException or JsonException or EndOfStreamException or FormatException)
        {
            return BadRequest(new { error = "Backup file is invalid, damaged, or does not match this clinic and database version." });
        }
    }

    public async Task<IActionResult> OnPostRestoreAsync(Guid id, IFormFile file, string password, bool safetyCopyDownloaded, CancellationToken cancellationToken)
    {
        if (!safetyCopyDownloaded || file is null || file.Length == 0)
        {
            BackupErrorMessage = "Download a current full backup and select a restore file first.";
            return RedirectToPage(new { id });
        }
        try
        {
            var manifest = await backups.RestoreAsync(file.OpenReadStream(), password, id, cancellationToken);
            BackupRestored(id, manifest.CreatedAt, string.Join(",", manifest.Modules));
            SuccessMessage = $"Clinic restored from {manifest.CreatedAt:u}.";
        }
        catch (Exception ex) when (ex is InvalidDataException or CryptographicException or ArgumentException or InvalidOperationException or JsonException or EndOfStreamException or FormatException or Npgsql.PostgresException)
        {
            RestoreRejected(ex, id);
            BackupErrorMessage = ex is InvalidOperationException ? ex.Message : "Restore failed validation or could not complete. No clinic data was changed.";
        }
        return RedirectToPage(new { id });
    }
}
