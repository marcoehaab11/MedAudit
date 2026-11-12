using System.ComponentModel.DataAnnotations;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants;
using DentalClinic.Infrastructure.Identity;
using FluentValidationException = FluentValidation.ValidationException;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class CreateModel(
    IClinicManagementService clinics,
    ILogger<CreateModel> logger) : PageModel
{
    private static readonly Action<ILogger, string, Exception?> LogCreateFailed =
        LoggerMessage.Define<string>(LogLevel.Error, new EventId(4101, "ClinicCreationFailed"),
            "Could not create clinic. TraceId: {TraceId}");

    [BindProperty] public InputModel Input { get; set; } = new();
    [TempData] public string? SuccessMessage { get; set; }
    [TempData] public string? CreatedAdminEmail { get; set; }
    [TempData] public string? CreatedAdminPassword { get; set; }
    [TempData] public string? CreatedClinicSlug { get; set; }
    [TempData] public string? CreatedInvitationToken { get; set; }

    public void OnGet() { }

    public async Task<IActionResult> OnPostAsync(CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        try
        {
            var result = await clinics.CreateAsync(new CreateClinicCommand(
                Input.Name,
                Input.Slug,
                Input.Phone,
                Input.Email,
                Input.Address,
                Input.City,
                Input.Country,
                Input.TimeZone,
                Input.Currency,
                Input.AdminEmail,
                Input.LogoReference,
                Input.SubscriptionMonths,
                Input.AdminPassword), cancellationToken);

            SuccessMessage = result.ExistingAdminAccount
                ? $"Clinic '{Input.Name}' created. Give the administrator the invitation link shown below. Their existing password was not changed."
                : !string.IsNullOrWhiteSpace(Input.AdminPassword)
                    ? $"Clinic '{Input.Name}' created. The administrator can sign in with the password you set."
                    : $"Clinic '{Input.Name}' created. Give the administrator the invitation link shown below to set a password.";
            CreatedAdminEmail = Input.AdminEmail;
            CreatedAdminPassword = result.ExistingAdminAccount ? null : Input.AdminPassword;
            CreatedClinicSlug = Input.Slug;
            CreatedInvitationToken = result.InvitationToken;

            return RedirectToPage("Details", new { id = result.TenantId });
        }
        catch (FluentValidationException exception)
        {
            foreach (var error in exception.Errors)
            {
                var property = error.PropertyName switch
                {
                    "Password" => nameof(Input.AdminPassword),
                    "Email" when error.ErrorMessage.Contains("account", StringComparison.OrdinalIgnoreCase)
                        => nameof(Input.AdminEmail),
                    _ => error.PropertyName
                };
                ModelState.AddModelError($"Input.{property}", error.ErrorMessage);
            }
            return Page();
        }
        catch (ArgumentException exception)
        {
            ModelState.AddModelError(string.Empty, $"Clinic details are invalid: {exception.Message}");
            return Page();
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_tenants_Slug" })
        {
            ModelState.AddModelError("Input.Slug", "This clinic slug is already in use. Choose a different slug.");
            return Page();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogCreateFailed(logger, HttpContext.TraceIdentifier, exception);
            ModelState.AddModelError(string.Empty,
                $"Could not create the clinic because of a server error. Reference: {HttpContext.TraceIdentifier}. Please check the server logs or contact support with this reference.");
            return Page();
        }
    }

    public sealed class InputModel
    {
        [Range(1, 120, ErrorMessage = "Choose between 1 and 120 months.")]
        [Display(Name = "Initial subscription (months)")]
        public int SubscriptionMonths { get; set; } = 1;
        [Required(ErrorMessage = "Clinic name is required"), StringLength(200)]
        [Display(Name = "Clinic Name")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Slug identifier is required"), StringLength(100)]
        [RegularExpression(@"^[a-z0-9]+(?:-[a-z0-9]+)*$", ErrorMessage = "Use lowercase English letters and numbers, with single hyphens only between words. Example: pearl-dental.")]
        [Display(Name = "Tenant Slug / Subdomain")]
        public string Slug { get; set; } = string.Empty;

        [Required(ErrorMessage = "Phone number is required"), StringLength(50)]
        [Display(Name = "Phone Number")]
        public string Phone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Contact email is required"), EmailAddress, StringLength(256)]
        [Display(Name = "Clinic Email")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Address is required"), StringLength(500)]
        [Display(Name = "Street Address")]
        public string Address { get; set; } = string.Empty;

        [Required(ErrorMessage = "City is required"), StringLength(100)]
        [Display(Name = "City")]
        public string City { get; set; } = string.Empty;

        [Required(ErrorMessage = "Country is required"), StringLength(100)]
        [Display(Name = "Country")]
        public string Country { get; set; } = string.Empty;

        [Required, StringLength(100)]
        [Display(Name = "Time Zone")]
        public string TimeZone { get; set; } = "UTC";

        [Required, StringLength(3, MinimumLength = 3)]
        [Display(Name = "Currency (3 Letters)")]
        public string Currency { get; set; } = "USD";

        [Required(ErrorMessage = "Admin email is required"), EmailAddress, StringLength(256)]
        [Display(Name = "Clinic Admin Email")]
        public string AdminEmail { get; set; } = string.Empty;

        [MinLength(12, ErrorMessage = "Password must be at least 12 characters")]
        [Display(Name = "Initial password for a new account (optional)")]
        public string? AdminPassword { get; set; }

        [StringLength(500)]
        [Display(Name = "Logo URL / Reference")]
        public string? LogoReference { get; set; }
    }
}
