using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var adminEmail = "admin@admin.com";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser is null)
        {
            adminUser = new ApplicationUser
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                IsPlatformAdmin = true
            };
            await userManager.CreateAsync(adminUser, "123456");
        }
        else if (!adminUser.IsPlatformAdmin)
        {
            adminUser.IsPlatformAdmin = true;
            await userManager.UpdateAsync(adminUser);
        }
    }
}
