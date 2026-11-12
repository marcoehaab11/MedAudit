using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class ClinicOnboardingTests(PlatformPostgresFixture fixture)
{
    [Fact]
    public async Task RegistrationBlocksLoginUntilConfirmationAndStartsOnlyOneTrial()
    {
        await using var provider = await CreateProviderAsync();
        await using var scope = provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ClinicOnboardingService>();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        await service.RegisterAsync(Input(), CancellationToken.None);
        var registration = await db.ClinicRegistrations.SingleAsync();
        var user = await users.FindByEmailAsync(Input().Email);
        Assert.NotNull(user);
        Assert.False(user.EmailConfirmed);
        Assert.Empty(await db.Tenants.ToListAsync());
        var auth = scope.ServiceProvider.GetRequiredService<IAuthenticationService>();
        Assert.Null(await auth.LoginAsync(new LoginCommand(Input().Email, Input().Password), CancellationToken.None));
        Assert.Equal("Confirmation", (await db.PlatformEmails.SingleAsync()).Kind);
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => service.ConfirmAsync(registration.Id, "invalid-token", CancellationToken.None));
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        await service.ConfirmAsync(registration.Id, token, CancellationToken.None);
        var clinic = await db.Tenants.SingleAsync();
        Assert.True(clinic.IsTrial);
        Assert.True(clinic.EmailVerifiedAt.HasValue);
        Assert.Equal(TimeSpan.FromDays(15), clinic.SubscriptionExpiresAt - clinic.SubscriptionStartsAt);
        Assert.True(clinic.ShowcaseConsent);
        Assert.False(clinic.ShowcasePublished);
        Assert.NotNull(await auth.LoginAsync(new LoginCommand(Input().Email, Input().Password), CancellationToken.None));
        var expires = clinic.SubscriptionExpiresAt;
        await service.ConfirmAsync(registration.Id, token, CancellationToken.None);
        Assert.Equal(expires, clinic.SubscriptionExpiresAt);
        Assert.Single(await db.PlatformEmails.Where(x => x.Kind == "Welcome").ToListAsync());
        await service.ForgotPasswordAsync(Input().Email, CancellationToken.None);
        Assert.Single(await db.PlatformEmails.Where(x => x.Kind == "PasswordReset").ToListAsync());
        var reset = await users.GeneratePasswordResetTokenAsync(user);
        await service.ResetPasswordAsync(Input().Email, reset, "Changed123", "Changed123");
        Assert.Null(await auth.LoginAsync(new LoginCommand(Input().Email, Input().Password), CancellationToken.None));
        Assert.NotNull(await auth.LoginAsync(new LoginCommand(Input().Email, "Changed123"), CancellationToken.None));
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => service.ResetPasswordAsync(Input().Email, reset, "Another123", "Another123"));
    }

    private async Task<ServiceProvider> CreateProviderAsync()
    {
        var connection = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString()) { Database = "onboarding_" + Guid.NewGuid().ToString("N"), Pooling = false }.ConnectionString;
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connection,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false",
            ["Onboarding:PublicAppUrl"] = "https://planora.example",
            ["Onboarding:ClinicAppUrl"] = "https://app.planora.example",
        }).Build();
        var services = new ServiceCollection();
        services.AddLogging(); services.AddApplication(); services.AddInfrastructure(configuration);
        services.AddSingleton<IAccessTokenIssuer, FakeIssuer>();
        var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
        return provider;
    }

    private static RegisterClinicInput Input() => new("Trial Clinic", "Owner", "trial@example.com", "01012345678", "Street", "Cairo", "Egypt", "Password123", "Password123", true);
    private sealed class FakeIssuer : IAccessTokenIssuer
    {
        public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => new("test", DateTimeOffset.UtcNow.AddHours(1));
    }
}
