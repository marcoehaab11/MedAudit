using System.ComponentModel.DataAnnotations;
using DentalClinic.Application.Tenants;
using DentalClinic.Infrastructure.Identity;
using FluentValidationException = FluentValidation.ValidationException;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Admin.Clinics;

[Authorize(Policy = AuthConstants.PlatformAdminPolicy)]
public sealed class EditModel(IClinicManagementService clinics) : PageModel
{
    [BindProperty] public InputModel Input { get; set; } = new();

    public async Task<IActionResult> OnGetAsync(Guid id, CancellationToken cancellationToken)
    {
        var clinic = await clinics.GetAsync(id, cancellationToken);
        if (clinic is null) return NotFound();
        Input = new InputModel
        {
            Id = clinic.Id,
            Name = clinic.Name,
            Slug = clinic.Slug,
            Phone = clinic.Phone,
            Email = clinic.Email,
            Address = clinic.Address,
            City = clinic.City,
            Country = clinic.Country,
            TimeZone = clinic.TimeZone,
            Currency = clinic.Currency,
            LogoReference = clinic.LogoReference
        };
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(Guid id, CancellationToken cancellationToken)
    {
        if (id != Input.Id) return BadRequest();
        if (!ModelState.IsValid) return Page();
        try
        {
            var updated = await clinics.UpdateAsync(new UpdateClinicCommand(
                Input.Id, Input.Name, Input.Slug, Input.Phone, Input.Email, Input.Address,
                Input.City, Input.Country, Input.TimeZone, Input.Currency, Input.LogoReference), cancellationToken);
            if (!updated) return NotFound();
            TempData["SuccessMessage"] = "Clinic details updated.";
            return RedirectToPage("Details", new { id = Input.Id });
        }
        catch (FluentValidationException exception)
        {
            foreach (var error in exception.Errors)
                ModelState.AddModelError($"Input.{error.PropertyName}", error.ErrorMessage);
            return Page();
        }
    }

    public sealed class InputModel
    {
        public Guid Id { get; set; }
        [Required, StringLength(200)] public string Name { get; set; } = string.Empty;
        [Required, StringLength(100)] public string Slug { get; set; } = string.Empty;
        [Required, StringLength(50)] public string Phone { get; set; } = string.Empty;
        [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = string.Empty;
        [Required, StringLength(500)] public string Address { get; set; } = string.Empty;
        [Required, StringLength(100)] public string City { get; set; } = string.Empty;
        [Required, StringLength(100)] public string Country { get; set; } = string.Empty;
        [Required, StringLength(100)] public string TimeZone { get; set; } = string.Empty;
        [Required, StringLength(3, MinimumLength = 3)] public string Currency { get; set; } = string.Empty;
        [StringLength(500)] public string? LogoReference { get; set; }
    }
}
