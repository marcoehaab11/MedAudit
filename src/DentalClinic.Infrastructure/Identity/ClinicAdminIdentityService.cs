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
    public async Task<IdentityAccountLink> CreateAdminAsync(
        Guid tenantId,
        string email,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await CreateInvitedUserAsync(tenantId, email, cancellationToken);
    }

    public async Task<IdentityAccountLink> CreateInvitedUserAsync(Guid tenantId, string email, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            if (existing.IsPlatformAdmin || await context.ClinicUsers.IgnoreQueryFilters()
                    .AnyAsync(x => x.TenantId == tenantId && x.IdentityUserId == existing.Id, cancellationToken))
                throw new ValidationException([new ValidationFailure("Email", "This account cannot be invited to this clinic.")]);
            return new IdentityAccountLink(Guid.NewGuid(), existing.Id, true);
        }
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
        return new IdentityAccountLink(user.Id, user.Id, false);
    }

    public async Task<Guid> CreateUserWithPasswordAsync(Guid tenantId, string email, string password, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            LockoutEnabled = true
        };
        EnsureSucceeded(await userManager.CreateAsync(user, password), "Password");
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
        var clinicUser = await context.ClinicUsers.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == userId && x.TenantId == tenantId, cancellationToken);
        var user = clinicUser is null ? null : await context.Users.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == clinicUser.IdentityUserId, cancellationToken);
        if (user is null) throw new ValidationException([new ValidationFailure("Token", "Invitation is invalid.")]);

        if (await userManager.HasPasswordAsync(user))
        {
            if (!await userManager.CheckPasswordAsync(user, password))
                throw new ValidationException([new ValidationFailure("Password", "Enter the password for your existing account.")]);
        }
        else
        {
            EnsureSucceeded(await userManager.AddPasswordAsync(user, password), "Password");
            user.EmailConfirmed = true;
            EnsureSucceeded(await userManager.UpdateAsync(user), "Password");
        }
        var now = DateTimeOffset.UtcNow;
        if (clinicUser is not null && clinicUser.Status == Domain.Identity.UserStatus.Invited)
        {
            clinicUser.AcceptInvitation(now);
        }

        var invitation = await context.AdminInvitations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.TenantId == tenantId && x.Status == Domain.Tenancy.AdminInvitationStatus.Pending, cancellationToken);
        if (invitation is not null)
        {
            invitation.TryAccept(now);
        }

        await context.SaveChangesAsync(cancellationToken);
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
