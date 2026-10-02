using System.ComponentModel.DataAnnotations;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants;
using DentalClinic.Infrastructure.Identity;
using FluentValidationException = FluentValidation.ValidationException;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class CreateModel(
    IClinicManagementService clinics,
    IIdentityCredentialService credentials) : PageModel
{
    [BindProperty] public InputModel Input { get; set; } = new();
    [TempData] public string? SuccessMessage { get; set; }
    [TempData] public string? CreatedAdminEmail { get; set; }
    [TempData] public string? CreatedAdminPassword { get; set; }
    [TempData] public string? CreatedClinicSlug { get; set; }

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
                Input.SubscriptionMonths), cancellationToken);

            if (!string.IsNullOrWhiteSpace(Input.AdminPassword))
            {
                await credentials.SetPasswordAsync(
                    result.TenantId,
                    result.AdminUserId,
                    Input.AdminPassword,
                    cancellationToken);
            }

            SuccessMessage = $"Clinic '{Input.Name}' created successfully with administrator credentials configured.";
            CreatedAdminEmail = Input.AdminEmail;
            CreatedAdminPassword = Input.AdminPassword;
            CreatedClinicSlug = Input.Slug;

            return RedirectToPage("Details", new { id = result.TenantId });
        }
        catch (FluentValidationException exception)
        {
            foreach (var error in exception.Errors)
            {
                ModelState.AddModelError($"Input.{error.PropertyName}", error.ErrorMessage);
            }
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
        [RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Slug may only contain lowercase letters, numbers, and hyphens.")]
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

        [Required(ErrorMessage = "Initial password is required"), MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
        [Display(Name = "Admin Initial Password")]
        public string AdminPassword { get; set; } = "ClinicAdmin123!";

        [StringLength(500)]
        [Display(Name = "Logo URL / Reference")]
        public string? LogoReference { get; set; }
    }
}
