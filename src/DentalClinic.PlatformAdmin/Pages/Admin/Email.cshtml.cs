using System.ComponentModel.DataAnnotations;
using DentalClinic.Domain.Platform;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.PlatformAdmin.Pages.Admin;

public sealed class EmailModel(PlatformMailService mail, ApplicationDbContext db) : PageModel
{
    [BindProperty] public PlatformMailSettings Input { get; set; } = new();
    [BindProperty] public string? Password { get; set; }
    [BindProperty] public string? TestEmail { get; set; }
    [TempData] public string? Message { get; set; }
    public bool HasPassword { get; private set; }
    public IReadOnlyList<PlatformEmail> Emails { get; private set; } = [];

    public async Task OnGetAsync(CancellationToken token)
    {
        Input = await mail.ReadSettingsAsync(token) ?? new();
        HasPassword = !string.IsNullOrEmpty(Input.ProtectedPassword);
        Input.ProtectedPassword = string.Empty;
        Emails = await db.PlatformEmails.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(40).ToArrayAsync(token);
    }

    public async Task<IActionResult> OnPostAsync(CancellationToken token)
    {
        try { await mail.SaveSettingsAsync(Input, Password, token); Message = "Email settings saved. Use Send test to verify delivery."; }
        catch (ArgumentException error) { Message = error.Message; }
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostTestAsync(CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(TestEmail) || !new EmailAddressAttribute().IsValid(TestEmail)) { Message = "Enter a valid test recipient."; return RedirectToPage(); }
        mail.Queue(TestEmail, "Planora SMTP test", "<h1>Planora</h1><p>Your platform email delivery test is successful.</p>", "Test");
        await db.SaveChangesAsync(token);
        Message = "Test email queued. Check its delivery status below and the recipient inbox.";
        return RedirectToPage();
    }

    public async Task<IActionResult> OnPostRetryAsync(Guid id, CancellationToken token)
    {
        await db.PlatformEmails.Where(x => x.Id == id && x.Status == "Failed" && x.ProtectedBody != "")
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, "Pending").SetProperty(x => x.Attempts, 0)
                .SetProperty(x => x.NextAttemptAt, DateTimeOffset.UtcNow), token);
        Message = "Failed email queued for retry.";
        return RedirectToPage();
    }
}
