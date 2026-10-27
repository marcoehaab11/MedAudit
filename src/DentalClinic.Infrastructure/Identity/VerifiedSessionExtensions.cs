using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.Infrastructure.Identity;

public static class VerifiedSessionExtensions
{
    public static IServiceCollection AddVerifiedSessions(this IServiceCollection services, string scheme)
    {
        services.AddSingleton<ServerSessionStore>();
        services.AddScoped<VerifiedSessionEvents>();
        services.AddOptions<CookieAuthenticationOptions>(scheme).Configure<ServerSessionStore>((options, store) => options.SessionStore = store);
        return services;
    }
}
