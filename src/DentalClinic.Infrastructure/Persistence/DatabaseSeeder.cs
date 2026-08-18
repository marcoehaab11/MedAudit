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

    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

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

            try
            {
                var createResult = await userManager.CreateAsync(adminUser, AdminPassword);
                if (!createResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Failed to seed platform admin: {string.Join(", ", createResult.Errors.Select(x => x.Description))}");
                }
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                context.Entry(adminUser).State = EntityState.Detached;
                adminUser = await FindAdminWithRetryAsync(userManager);

                if (adminUser is null)
                {
                    throw new InvalidOperationException(
                        "A concurrent platform-admin seed detected an existing user, but the user could not be read after the unique-key conflict.",
                        ex);
                }
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

    private static async Task<ApplicationUser?> FindAdminAsync(UserManager<ApplicationUser> userManager)
    {
        var adminUser = await userManager.FindByIdAsync(PlatformAdminId.ToString());
        return adminUser ?? await userManager.FindByEmailAsync(AdminEmail);
    }

    private static async Task<ApplicationUser?> FindAdminWithRetryAsync(
        UserManager<ApplicationUser> userManager)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var adminUser = await FindAdminAsync(userManager);
            if (adminUser is not null)
            {
                return adminUser;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250 * (attempt + 1)));
        }

        return null;
    }

    private static bool IsUniqueViolation(DbUpdateException exception)
    {
        return exception.InnerException is PostgresException postgresException
            && postgresException.SqlState == PostgresErrorCodes.UniqueViolation;
    }
}
