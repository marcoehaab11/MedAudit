using DentalClinic.Application.Tenants;
using DentalClinic.Application.Identity;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Identity;

internal sealed class ClinicAdminIdentityService(
    UserManager<ApplicationUser> userManager,
    DentalClinic.Infrastructure.Persistence.ApplicationDbContext context,
    DentalClinic.Infrastructure.Persistence.PlatformWriteScope writeScope)
    : IClinicAdminIdentityService, IIdentityCredentialService
{
    public async Task<Guid> CreateAdminAsync(
        Guid tenantId,
        string email,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await CreateInvitedUserAsync(tenantId, email, cancellationToken);
    }

    public async Task<Guid> CreateInvitedUserAsync(Guid tenantId, string email, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserName = email,
            Email = email,
            EmailConfirmed = false,
            LockoutEnabled = true
        };
        EnsureSucceeded(await userManager.CreateAsync(user), "Email");
        return user.Id;
    }

    public async Task SetPasswordAsync(
        Guid tenantId,
        Guid userId,
        string password,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        using var scope = writeScope.Enter(tenantId);
        var user = await context.Users.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId, cancellationToken);
        if (user is null) throw new ValidationException([new ValidationFailure("Token", "Invitation is invalid.")]);
        EnsureSucceeded(await userManager.AddPasswordAsync(user, password), "Password");
        user.EmailConfirmed = true;
        EnsureSucceeded(await userManager.UpdateAsync(user), "Password");
    }

    public async Task<bool> CheckPasswordAsync(Guid userId, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await context.Users.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        return user is not null && await userManager.CheckPasswordAsync(user, password);
    }

    private static void EnsureSucceeded(IdentityResult result, string propertyName)
    {
        if (!result.Succeeded)
        {
            throw new ValidationException(result.Errors.Select(error =>
                new ValidationFailure(propertyName, error.Description)));
        }
    }
}
