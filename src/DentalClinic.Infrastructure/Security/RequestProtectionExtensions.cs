using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.Infrastructure.Security;

public static class RequestProtectionExtensions
{
    public static IServiceCollection AddRequestProtection(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IRequestLimitStore, RedisRequestLimitStore>();
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
            options.ForwardLimit = 1;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            foreach (var address in (configuration["RateLimiting:TrustedProxies"] ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
                options.KnownProxies.Add(IPAddress.Parse(address));
            // An empty trust list means trust nobody, rather than ASP.NET's trust-everyone behavior.
            if (options.KnownProxies.Count == 0) options.KnownProxies.Add(IPAddress.IPv6None);
        });
        return services;
    }
}
