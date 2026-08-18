using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    private static readonly Guid PlatformAdminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private const string AdminEmail = "admin@admin.com";
    private const string AdminPassword = "123456";

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        // Resolve the seeded admin by its stable ID first. This makes the seeder
        // idempotent even if the email was changed or the existing row was created
        // by an earlier deployment.
        var adminUser = await userManager.FindByIdAsync(PlatformAdminId.ToString());
        if (adminUser is null)
        {
            adminUser = await userManager.FindByEmailAsync(AdminEmail);
        }

        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Id = PlatformAdminId,
                UserName = AdminEmail,
                Email = AdminEmail,
                EmailConfirmed = true,
                IsPlatformAdmin = true
            };

            var createResult = await userManager.CreateAsync(adminUser, AdminPassword);
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to seed platform admin: {string.Join(", ", createResult.Errors.Select(x => x.Description))}");
            }
        }
        else if (!adminUser.IsPlatformAdmin)
        {
            adminUser.IsPlatformAdmin = true;

            var updateResult = await userManager.UpdateAsync(adminUser);
            if (!updateResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to update platform admin: {string.Join(", ", updateResult.Errors.Select(x => x.Description))}");
            }
        }
    }
}
