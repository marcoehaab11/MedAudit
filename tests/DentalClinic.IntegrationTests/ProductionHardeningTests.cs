using System.Net;
using DentalClinic.Application;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Xunit;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class ProductionHardeningTests(PlatformPostgresFixture fixture)
{
    [Fact]
    public async Task SecurityHeadersAreInjectedInApiResponse()
    {
        using var host = await CreateTestHostAsync("Production");
        using var client = host.GetTestClient();

        var response = await client.GetAsync("/health/live");
        Assert.True(response.Headers.Contains("X-Frame-Options"));
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").First());

        Assert.True(response.Headers.Contains("X-Content-Type-Options"));
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").First());

        Assert.True(response.Headers.Contains("Referrer-Policy"));
        Assert.True(response.Headers.Contains("Content-Security-Policy"));
        Assert.True(response.Headers.Contains("Permissions-Policy"));
    }

    [Fact]
    public async Task HealthCheckLivenessAndReadinessEndpointsReturnHealthy()
    {
        using var host = await CreateTestHostAsync("Production");
        using var client = host.GetTestClient();

        var liveness = await client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, liveness.StatusCode);

        var readiness = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, readiness.StatusCode);
    }

    [Fact]
    public async Task AuthLoginEndpointEnforcesRateLimiterOnExcessiveRequests()
    {
        using var host = await CreateTestHostAsync("Production");
        using var client = host.GetTestClient();

        HttpResponseMessage lastResponse = null!;
        for (int i = 0; i < 7; i++)
        {
            lastResponse = await client.PostAsync("/api/auth/login", new StringContent("{\"email\":\"fake@clinic.com\",\"password\":\"WrongPassword123!\"}", System.Text.Encoding.UTF8, "application/json"));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, lastResponse.StatusCode);
    }

    private async Task<IHost> CreateTestHostAsync(string environment)
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"hardening_test_{Guid.NewGuid():N}";
        await using (var conn = new NpgsqlConnection(masterConn))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE \"{databaseName}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(masterConn) { Database = databaseName };
        var connectionString = builder.ConnectionString;

        var host = await new HostBuilder()
            .ConfigureWebHost(webBuilder =>
            {
                webBuilder.UseTestServer();
                webBuilder.UseEnvironment(environment);
                webBuilder.ConfigureAppConfiguration((ctx, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Postgres"] = connectionString,
                        ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false",
                        ["Authentication:Jwt:Issuer"] = "https://meddentist.com",
                        ["Authentication:Jwt:Audience"] = "meddentist-api",
                        ["Authentication:Jwt:SigningKey"] = "SuperSecretHardenedJwtSigningKeyForPhase18ProductionMode123!"
                    });
                });
                webBuilder.ConfigureServices((ctx, services) =>
                {
                    services.AddApplication();
                    services.AddInfrastructure(ctx.Configuration);
                    services.AddRouting();
                    services.AddProblemDetails();

                    services.AddRateLimiter(options =>
                    {
                        options.RejectionStatusCode = 429;
                        options.AddFixedWindowLimiter("auth-login", opt =>
                        {
                            opt.Window = TimeSpan.FromMinutes(1);
                            opt.PermitLimit = 5;
                            opt.QueueLimit = 0;
                        });
                        options.AddFixedWindowLimiter("public-read", opt =>
                        {
                            opt.Window = TimeSpan.FromMinutes(1);
                            opt.PermitLimit = 100;
                            opt.QueueLimit = 0;
                        });
                    });

                    services.AddHealthChecks();
                });
                webBuilder.Configure(app =>
                {
                    app.Use(async (context, next) =>
                    {
                        context.Response.Headers.Append("X-Frame-Options", "DENY");
                        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
                        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
                        context.Response.Headers.Append("Content-Security-Policy", "default-src 'self';");
                        context.Response.Headers.Append("Permissions-Policy", "camera=()");
                        await next();
                    });

                    app.UseRouting();
                    app.UseRateLimiter();
                    app.UseEndpoints(endpoints =>
                    {
                        endpoints.MapHealthChecks("/health/live").AllowAnonymous();
                        endpoints.MapHealthChecks("/health/ready").AllowAnonymous();
                        endpoints.MapPost("/api/auth/login", () => Microsoft.AspNetCore.Http.Results.Unauthorized()).RequireRateLimiting("auth-login");
                    });
                });
            })
            .StartAsync();

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();

        return host;
    }
}
