using System.Globalization;
using System.Threading.RateLimiting;
using DentalClinic.Api.Endpoints;
using DentalClinic.Api.Extensions;
using DentalClinic.Api.Identity;
using DentalClinic.Api.Middleware;
using DentalClinic.Application;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Service", "DentalClinic.Api")
    .WriteTo.Console(formatProvider: CultureInfo.InvariantCulture));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiAuthentication(builder.Configuration);
builder.Services.AddApiAuthorization();
builder.Services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("public-read", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 100;
        opt.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("public-booking", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 0;
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();

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
app.MapPatientEndpoints();
app.MapDoctorEndpoints();
app.MapAppointmentEndpoints();
app.MapDentalEndpoints();
app.MapTreatmentEndpoints();
app.MapPrescriptionEndpoints();
app.MapCrmEndpoints();
app.MapFinanceEndpoints();
app.MapReportEndpoints();
app.MapPublicBookingEndpoints();
app.MapNotificationEndpoints();
app.MapInventoryEndpoints();
app.MapPharmacyEndpoints();

app.Run();

public partial class Program;
