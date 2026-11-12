using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Mail;
using DentalClinic.Domain.Platform;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DentalClinic.Infrastructure.Services;

public sealed class PlatformMailService(ApplicationDbContext db, IDataProtectionProvider protection, IConfiguration configuration)
{
    private readonly IDataProtector protector = protection.CreateProtector("Planora.PlatformMail.v1");

    public async Task<PlatformMailSettings?> ReadSettingsAsync(CancellationToken token)
    {
        using var databaseAccess = db.Access.MailQueue();
        return await db.PlatformMailSettings.AsNoTracking().SingleOrDefaultAsync(token);
    }

    public async Task SaveSettingsAsync(PlatformMailSettings input, string? password, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(input.Host) || input.Port is < 1 or > 65535 ||
            !new EmailAddressAttribute().IsValid(input.FromEmail) || !ValidUrl(input.PublicAppUrl) || !ValidUrl(input.ClinicAppUrl))
            throw new ArgumentException("Enter a valid SMTP host, port, sender and public application URLs.");
        if (input.Port == 465) throw new ArgumentException("Use the provider's STARTTLS port (usually 587). Implicit TLS on port 465 is not supported.");
        var settings = await db.PlatformMailSettings.SingleOrDefaultAsync(token);
        if (settings is null) { settings = new PlatformMailSettings(); db.PlatformMailSettings.Add(settings); }
        settings.Host = input.Host.Trim(); settings.Port = input.Port; settings.EnableSsl = input.EnableSsl;
        settings.Username = input.Username.Trim(); settings.FromEmail = input.FromEmail.Trim(); settings.FromName = input.FromName.Trim();
        settings.PublicAppUrl = input.PublicAppUrl.TrimEnd('/'); settings.ClinicAppUrl = input.ClinicAppUrl.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(password)) settings.ProtectedPassword = protector.Protect(password);
        await db.SaveChangesAsync(token);
    }

    private static bool ValidUrl(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == "https" || (uri.Scheme == "http" && uri.IsLoopback)) && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment);

    public async Task<string> AppUrlAsync(bool publicApp, CancellationToken token)
    {
        var settings = await ReadSettingsAsync(token);
        var url = publicApp ? settings?.PublicAppUrl : settings?.ClinicAppUrl;
        url ??= configuration[publicApp ? "Onboarding:PublicAppUrl" : "Onboarding:ClinicAppUrl"];
        if (string.IsNullOrWhiteSpace(url) || !ValidUrl(url)) throw new ArgumentException("Platform email and public application URLs must be configured by the administrator first.");
        return url.TrimEnd('/');
    }

    public void Queue(string destination, string subject, string body, string kind, Guid? registrationId = null)
    {
        db.PlatformEmails.Add(new PlatformEmail
        {
            Destination = destination,
            Subject = subject,
            ProtectedBody = protector.Protect(body),
            Kind = kind,
            RegistrationId = registrationId,
            CreatedAt = DateTimeOffset.UtcNow,
            NextAttemptAt = DateTimeOffset.UtcNow
        });
    }

    public async Task SendAsync(string destination, string subject, string body, CancellationToken token)
    {
        var settings = await ReadSettingsAsync(token);
        var host = settings?.Host ?? configuration["Smtp:Host"] ?? configuration["SMTP_HOST"];
        var from = settings?.FromEmail ?? configuration["Smtp:From"] ?? configuration["SMTP_FROM"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from)) throw new InvalidOperationException("SMTP is not configured.");
        using var client = new SmtpClient(host, settings?.Port ?? (int.TryParse(configuration["Smtp:Port"] ?? configuration["SMTP_PORT"], out var port) ? port : 587));
        client.EnableSsl = settings?.EnableSsl ?? !string.Equals(configuration["Smtp:EnableSsl"] ?? configuration["SMTP_ENABLE_SSL"], "false", StringComparison.OrdinalIgnoreCase);
        var username = settings?.Username ?? configuration["Smtp:Username"] ?? configuration["SMTP_USERNAME"];
        var password = settings is not null && settings.ProtectedPassword.Length > 0 ? protector.Unprotect(settings.ProtectedPassword) : configuration["Smtp:Password"] ?? configuration["SMTP_PASSWORD"];
        if (!string.IsNullOrWhiteSpace(username)) client.Credentials = new NetworkCredential(username, password);
        using var message = new MailMessage { From = new MailAddress(from, settings?.FromName ?? "Planora"), Subject = subject, Body = body, IsBodyHtml = true };
        message.To.Add(destination);
        await client.SendMailAsync(message, token);
    }

    public async Task ProcessQueueAsync(CancellationToken token)
    {
        using var databaseAccess = db.Access.MailQueue();
        var now = DateTimeOffset.UtcNow;
        var ids = await db.PlatformEmails.AsNoTracking().Where(x => (x.Status == "Pending" || x.Status == "Sending") && x.NextAttemptAt <= now)
            .OrderBy(x => x.CreatedAt).Select(x => x.Id).Take(10).ToArrayAsync(token);
        foreach (var id in ids)
        {
            var claimed = await db.PlatformEmails.Where(x => x.Id == id && (x.Status == "Pending" || x.Status == "Sending") && x.NextAttemptAt <= now)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.Status, "Sending").SetProperty(x => x.NextAttemptAt, now.AddMinutes(3)), token);
            if (claimed == 0) continue;
            var email = await db.PlatformEmails.SingleAsync(x => x.Id == id, token);
            email.Attempts++;
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                timeout.CancelAfter(TimeSpan.FromSeconds(30));
                await SendAsync(email.Destination, email.Subject, protector.Unprotect(email.ProtectedBody), timeout.Token);
                email.Status = "Sent"; email.SentAt = DateTimeOffset.UtcNow; email.LastError = null;
                email.ProtectedBody = string.Empty;
            }
            catch (Exception error) when (!token.IsCancellationRequested)
            {
                email.LastError = error is InvalidOperationException ? "SMTP is not configured." : "Delivery failed: " + error.GetType().Name;
                email.Status = email.Attempts >= 5 ? "Failed" : "Pending";
                email.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(Math.Min(60, email.Attempts * 2));
            }
            await db.SaveChangesAsync(token);
        }
    }
}

public sealed partial class PlatformMailQueueHost(IServiceScopeFactory scopes, ILogger<PlatformMailQueueHost> logger) : BackgroundService
{
    [LoggerMessage(Level = LogLevel.Warning, Message = "Platform mail queue processing failed")]
    private partial void QueueFailed(Exception error);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<PlatformMailService>().ProcessQueueAsync(stoppingToken);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested) { QueueFailed(error); }
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
