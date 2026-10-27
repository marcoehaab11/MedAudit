using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DentalClinic.PlatformAdmin.Pages.Account;

[AllowAnonymous]
public sealed class LoginModel(
    UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager,
    DentalClinic.Infrastructure.Persistence.DatabaseAccessScope databaseAccess) : PageModel
{
    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? ErrorMessage { get; set; }

    public class InputModel
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;
    }

    public void OnGet()
    {
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        using var access = databaseAccess.Authentication();
        returnUrl ??= Url.Content("~/");

        if (!ModelState.IsValid)
        {
            return Page();
        }

        var user = await userManager.FindByEmailAsync(Input.Email);
        if (user == null || !user.IsPlatformAdmin || user.TenantId is not null)
        {
            ErrorMessage = "Invalid credentials or non-admin account.";
            return Page();
        }

        var checkPassword = await signInManager.CheckPasswordSignInAsync(user, Input.Password, lockoutOnFailure: true);
        if (!checkPassword.Succeeded)
        {
            ErrorMessage = "Invalid email or password.";
            return Page();
        }

        await HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        await signInManager.SignInWithClaimsAsync(user,
            new AuthenticationProperties { IsPersistent = false, ExpiresUtc = DateTimeOffset.UtcNow.AddHours(12), AllowRefresh = false },
            [new Claim(ClaimTypes.Role, AuthConstants.PlatformAdminRole),
             new Claim(VerifiedSessionEvents.IdentityClaim, user.Id.ToString("D")),
             new Claim(VerifiedSessionEvents.StampClaim, user.SecurityStamp!)]);

        return LocalRedirect(returnUrl);
    }
}
