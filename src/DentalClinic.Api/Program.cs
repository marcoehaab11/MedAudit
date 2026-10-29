using DentalClinic.Infrastructure.Security;
using System.Globalization;
using DentalClinic.Api.Endpoints;
using DentalClinic.Api.Extensions;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Api.Middleware;
using DentalClinic.Application;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;

var migrateDatabase = args.Contains("--migrate", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--migrate").ToArray());

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Service", "DentalClinic.Api")
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture));

builder.Services.AddHostedService<DentalClinic.Infrastructure.Services.PlatformMailQueueHost>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiAuthentication(builder.Configuration);
builder.Services.AddApiAuthorization();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddRequestProtection(builder.Configuration);

var app = builder.Build();

app.UseForwardedHeaders();

if (migrateDatabase)
{
    await DentalClinic.Infrastructure.Persistence.DatabaseSecurityBootstrap.MigrateAsync(app.Services, builder.Configuration);
    return;
}
await DentalClinic.Infrastructure.Persistence.DatabaseSecurityBootstrap.VerifyRuntimeAsync(app.Services);

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    await next();
});

app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseSerilogRequestLogging();
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseMiddleware<SessionSecurityMiddleware>();
app.UseAuthentication();
app.UseMiddleware<RequestLimitMiddleware>(false);
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = HealthResponseWriter.WriteAsync
}).AllowAnonymous();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthResponseWriter.WriteAsync
}).AllowAnonymous();

app.MapIdentityEndpoints();
app.MapOnboardingEndpoints();
app.MapPatientEndpoints();
app.MapDoctorEndpoints();
app.MapAppointmentEndpoints();
app.MapDentalEndpoints();
app.MapImplantEndpoints();
app.MapClinicalWorkflowEndpoints();
app.MapTreatmentEndpoints();
app.MapPrescriptionEndpoints();
app.MapCrmEndpoints();
app.MapFinanceEndpoints();
app.MapClinicBusinessEndpoints();
app.MapBackupEndpoints();
app.MapReportEndpoints();
app.MapPublicBookingEndpoints();
app.MapOnlineBookingManagementEndpoints();
app.MapNotificationEndpoints();
app.MapInventoryEndpoints();
app.MapPharmacyEndpoints();
app.MapSettingsEndpoints();
app.MapBranchEndpoints();

app.Run();

public partial class Program;
