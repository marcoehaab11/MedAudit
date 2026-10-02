using System.Globalization;
using DentalClinic.Application;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Tenancy;
using DentalClinic.PlatformAdmin.Monitoring;
using Microsoft.AspNetCore.Identity;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Service", "DentalClinic.PlatformAdmin")
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpClient(nameof(PlatformHealthMonitor), client => client.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddHostedService<PlatformHealthMonitor>();
builder.Services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.AccessDeniedPath = "/Account/Login";
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthConstants.PlatformAdminPolicy, policy =>
        policy.RequireAuthenticatedUser()
            .RequireAssertion(context => PlatformAccess.IsPlatformAdmin(context.User)));
});

builder.Services.AddRazorPages(options =>
{
    options.Conventions.AllowAnonymousToPage("/Account/Login");
    options.Conventions.AuthorizeFolder("/", AuthConstants.PlatformAdminPolicy);
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.All;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

await DatabaseSeeder.SeedAsync(app.Services);

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
}).AllowAnonymous();

app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();

app.MapRazorPages();
app.Run();
