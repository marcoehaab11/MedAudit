using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Net;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using ValidationException = FluentValidation.ValidationException;
using FluentValidation.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Services;

public sealed record RegisterClinicInput(string ClinicName, string OwnerName, string Email, string Phone,
    string Address, string City, string Country, string Password, string ConfirmPassword,
    bool ShowcaseConsent, string? LogoBase64 = null);

public sealed class ClinicOnboardingService(ApplicationDbContext db, UserManager<ApplicationUser> users,
    IEnumerable<ITenantInitializer> initializers, PlatformWriteScope writeScope, PlatformMailService mail, ISystemClock clock)
{
    public async Task RegisterAsync(RegisterClinicInput input, CancellationToken token)
    {
        using var databaseAccess = db.Access.Onboarding();
        var name = Required(input.ClinicName, 200); var owner = Required(input.OwnerName, 200);
        var email = Required(input.Email, 256).ToLowerInvariant();
        var phone = Required(input.Phone, 50); var address = Required(input.Address, 500);
        var city = Required(input.City, 100); var country = Required(input.Country, 100);
        if (!new EmailAddressAttribute().IsValid(email)) throw Invalid("Email", "Enter a valid email address.");
        if (string.IsNullOrEmpty(input.Password) || input.Password.Length < 8 || input.Password.Length > 128 || input.Password != input.ConfirmPassword)
            throw Invalid("Password", "Use 8–128 characters and matching passwords.");
        var (logo, contentType) = DecodeLogo(input.LogoBase64);
        // Never attach a public registration to another person's existing identity.
        if (await users.FindByEmailAsync(email) is not null) return;
        var url = await mail.AppUrlAsync(true, token);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var user = new ApplicationUser { Id = Guid.NewGuid(), Email = email, UserName = email, LockoutEnabled = true };
        Succeeded(await users.CreateAsync(user, input.Password));
        var registration = new ClinicRegistration { IdentityUserId = user.Id, ClinicName = name, OwnerName = owner,
            Email = email, Phone = phone, Address = address, City = city, Country = country,
            ShowcaseConsent = input.ShowcaseConsent, Logo = logo, LogoContentType = contentType, CreatedAt = clock.UtcNow };
        db.ClinicRegistrations.Add(registration);
        await QueueConfirmationAsync(registration, user, url);
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
    }

    public async Task ResendAsync(string email, CancellationToken token)
    {
        using var databaseAccess = db.Access.Onboarding();
        if (string.IsNullOrWhiteSpace(email)) return;
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var registration = await db.ClinicRegistrations.SingleOrDefaultAsync(x => x.Email == normalizedEmail, token);
        if (registration is null || registration.VerifiedAt.HasValue || registration.LastConfirmationSentAt > clock.UtcNow.AddMinutes(-2)) return;
        var user = await users.FindByIdAsync(registration.IdentityUserId.ToString());
        if (user is null) return;
        var url = await mail.AppUrlAsync(true, token);
        await QueueConfirmationAsync(registration, user, url);
        await db.SaveChangesAsync(token);
    }

    private async Task QueueConfirmationAsync(ClinicRegistration registration, ApplicationUser user, string url)
    {
        var confirmation = await users.GenerateEmailConfirmationTokenAsync(user);
        var link = $"{url}/confirm-email?id={registration.Id:D}&token={Uri.EscapeDataString(confirmation)}";
        mail.Queue(registration.Email, "Confirm your clinic · تأكيد بريد عيادتك", $"<div dir='rtl'><h1>أهلاً بك في Planora</h1><p>أكد بريدك لتفعيل عيادة {WebUtility.HtmlEncode(registration.ClinicName)} وبدء تجربتك المجانية لمدة 15 يومًا.</p><p><a href='{WebUtility.HtmlEncode(link)}'>تأكيد الإيميل وتفعيل العيادة</a></p><p>الرابط صالح لمدة ساعة. إن لم تطلب التسجيل تجاهل الرسالة.</p></div>", "Confirmation", registration.Id);
        registration.LastConfirmationSentAt = clock.UtcNow;
    }

    public async Task ConfirmAsync(Guid id, string confirmation, CancellationToken token)
    {
        using var databaseAccess = db.Access.Onboarding();
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var registration = await db.ClinicRegistrations.FromSqlInterpolated($"SELECT * FROM clinic_registrations WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(token);
        if (registration is null) throw Invalid("Token", "The confirmation link is invalid.");
        var user = await users.FindByIdAsync(registration.IdentityUserId.ToString());
        if (user is null) throw Invalid("Token", "The confirmation link is invalid.");
        if (!await users.VerifyUserTokenAsync(user, users.Options.Tokens.EmailConfirmationTokenProvider, "EmailConfirmation", confirmation))
            throw Invalid("Token", "The confirmation link is invalid or expired. Request a new email.");
        if (registration.VerifiedAt.HasValue) return;
        Succeeded(await users.ConfirmEmailAsync(user, confirmation));
        var now = clock.UtcNow;
        var tenant = new Tenant(registration.ClinicName, "clinic-" + registration.Id.ToString("N")[..12], registration.Phone,
            registration.Email, registration.Address, registration.City, registration.Country, "Africa/Cairo", "EGP", now,
            registration.Logo is null ? null : "/api/public/clinics/logos/" + registration.Id.ToString("D"));
        tenant.StartVerifiedTrial(now, registration.ShowcaseConsent);
        db.Tenants.Add(tenant);
        using var scope = writeScope.Enter(tenant.Id);
        await db.SaveChangesAsync(token);
        foreach (var initializer in initializers) await initializer.InitializeAsync(tenant, token);
        await db.SaveChangesAsync(token);
        var role = await db.TenantRoles.IgnoreQueryFilters().SingleAsync(x => x.TenantId == tenant.Id && x.NormalizedName == "CLINICADMIN", token);
        var member = new ClinicUser(Guid.NewGuid(), tenant.Id, registration.OwnerName, registration.Phone, UserStatus.Active, now, user.Id);
        db.ClinicUsers.Add(member);
        db.UserRoleAssignments.Add(new UserRoleAssignment(tenant.Id, member.Id, role.Id, now));
        user.TenantId = tenant.Id;
        Succeeded(await users.UpdateAsync(user));
        registration.TenantId = tenant.Id; registration.VerifiedAt = now;
        db.PlatformAuditLogs.Add(new PlatformAuditLog(tenant.Id, member.Id, PlatformAuditAction.TenantCreated, nameof(Tenant), tenant.Id, now, null));
        var loginUrl = await mail.AppUrlAsync(false, token);
        mail.Queue(registration.Email, "Welcome to Planora · أهلاً بعيادتك", $"<div dir='rtl'><h1>أهلاً {WebUtility.HtmlEncode(registration.OwnerName)}</h1><p>عيادة {WebUtility.HtmlEncode(tenant.Name)} جاهزة. تجربتك مجانية لمدة 15 يومًا حتى {tenant.SubscriptionExpiresAt.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)} UTC.</p><p><a href='{WebUtility.HtmlEncode(loginUrl + "/login")}'>دخول العيادة</a></p><p>استخدم بريدك وكلمة السر التي اخترتها أثناء التسجيل.</p></div>", "Welcome", registration.Id);
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
    }

    public async Task ForgotPasswordAsync(string email, CancellationToken token)
    {
        using var databaseAccess = db.Access.Onboarding();
        if (string.IsNullOrWhiteSpace(email)) return;
        var url = await mail.AppUrlAsync(false, token);
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || !user.EmailConfirmed || user.IsPlatformAdmin) return;
        if (await db.PlatformEmails.AnyAsync(x => x.Destination == user.Email && x.Kind == "PasswordReset" && x.CreatedAt > clock.UtcNow.AddMinutes(-2), token)) return;
        var reset = await users.GeneratePasswordResetTokenAsync(user);
        var link = $"{url}/reset-password?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(reset)}";
        mail.Queue(user.Email!, "Reset password · استرجاع كلمة السر", $"<div dir='rtl'><h1>تعيين كلمة سر جديدة</h1><p><a href='{WebUtility.HtmlEncode(link)}'>تغيير كلمة السر</a></p><p>الرابط صالح لمدة ساعة ويمكن استخدامه مرة واحدة. لو لم تطلبه تجاهل الرسالة.</p></div>", "PasswordReset");
        await db.SaveChangesAsync(token);
    }

    public async Task ResetPasswordAsync(string email, string reset, string password, string confirm)
    {
        using var databaseAccess = db.Access.Onboarding();
        if (string.IsNullOrEmpty(password) || password.Length is < 8 or > 128 || password != confirm) throw Invalid("Password", "Use 8–128 characters and matching passwords.");
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || !user.EmailConfirmed || user.IsPlatformAdmin) throw Invalid("Token", "The reset link is invalid or expired.");
        Succeeded(await users.ResetPasswordAsync(user, reset, password));
    }

    private static string Required(string value, int maximum) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= maximum
        ? value.Trim() : throw Invalid("Registration", "Complete all required clinic details within the permitted length.");
    private static ValidationException Invalid(string field, string message) => new([new ValidationFailure(field, message)]);
    private static void Succeeded(IdentityResult result)
    {
        if (!result.Succeeded) throw new ValidationException(result.Errors.Select(x => new ValidationFailure("Account", x.Description)));
    }

    public static (byte[]? Bytes, string? ContentType) DecodeLogo(string? encoded)
    {
        if (string.IsNullOrEmpty(encoded)) return (null, null);
        if (encoded.Length > 1_400_000) throw Invalid("Logo", "Logo must be a PNG or JPEG smaller than 1 MB.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(encoded); }
        catch (FormatException) { throw Invalid("Logo", "Invalid logo file."); }
        if (bytes.Length > 1_048_576) throw Invalid("Logo", "Logo must be smaller than 1 MB.");
        if (bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return (bytes, "image/png");
        if (bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 })) return (bytes, "image/jpeg");
        throw Invalid("Logo", "Only PNG and JPEG logos are accepted.");
    }
}
