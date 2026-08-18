using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    private static readonly Guid PlatformAdminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private const string AdminEmail = "admin@admin.com";
    private const string AdminPassword = "123456";
    private const long PlatformAdminSeedLockKey = 4815162342L;

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        // Multiple API replicas can start at the same time. Serialize only the platform-admin
        // seed section so the initial lookup and CreateAsync cannot race on the fixed primary key.
        await context.Database.OpenConnectionAsync();
        try
        {
            await context.Database.ExecuteSqlRawAsync(
                $"SELECT pg_advisory_lock({PlatformAdminSeedLockKey});");

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var adminUser = await FindAdminAsync(userManager);

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

            if (!adminUser.IsPlatformAdmin)
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
        finally
        {
            await context.Database.ExecuteSqlRawAsync(
                $"SELECT pg_advisory_unlock({PlatformAdminSeedLockKey});");
            await context.Database.CloseConnectionAsync();
        }
    }

    private static async Task<ApplicationUser?> FindAdminAsync(UserManager<ApplicationUser> userManager)
    {
        var adminUser = await userManager.FindByIdAsync(PlatformAdminId.ToString());
        return adminUser ?? await userManager.FindByEmailAsync(AdminEmail);
    }
}
