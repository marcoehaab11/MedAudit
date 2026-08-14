using System.ComponentModel.DataAnnotations;
using DentalClinic.Application.Tenants;
using DentalClinic.Infrastructure.Identity;
using FluentValidationException = FluentValidation.ValidationException;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class CreateModel(IClinicManagementService clinics) : PageModel
{
    [BindProperty] public InputModel Input { get; set; } = new();
    [TempData] public string? SuccessMessage { get; set; }

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
                Input.LogoReference), cancellationToken);
            SuccessMessage = "Clinic created and administrator invitation prepared.";
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
        [Required, StringLength(200)] public string Name { get; set; } = string.Empty;
        [Required, StringLength(100)] public string Slug { get; set; } = string.Empty;
        [Required, StringLength(50)] public string Phone { get; set; } = string.Empty;
        [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = string.Empty;
        [Required, StringLength(500)] public string Address { get; set; } = string.Empty;
        [Required, StringLength(100)] public string City { get; set; } = string.Empty;
        [Required, StringLength(100)] public string Country { get; set; } = string.Empty;
        [Required, StringLength(100)] public string TimeZone { get; set; } = "UTC";
        [Required, StringLength(3, MinimumLength = 3)] public string Currency { get; set; } = "USD";
        [Required, EmailAddress, StringLength(256)] public string AdminEmail { get; set; } = string.Empty;
        [StringLength(500)] public string? LogoReference { get; set; }
    }
}
