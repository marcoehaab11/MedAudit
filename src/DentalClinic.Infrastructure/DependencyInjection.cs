using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Treatments;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Application.Crm;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Reports;
using DentalClinic.Application.Inventory;
using DentalClinic.Application.Pharmacy;
using DentalClinic.Infrastructure.Prescriptions;
using DentalClinic.Infrastructure.Services;
using DentalClinic.Infrastructure.Health;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Tenancy;
using DentalClinic.Infrastructure.Time;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using StackExchange.Redis;

namespace DentalClinic.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var postgres = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is required.");
        var redis = configuration.GetConnectionString("Redis")
            ?? throw new InvalidOperationException("ConnectionStrings:Redis is required.");

        services.AddScoped<CurrentTenant>();
        services.AddScoped<ICurrentTenant>(provider => provider.GetRequiredService<CurrentTenant>());
        services.AddScoped<PlatformWriteScope>();
        services.AddScoped<IPlatformClinicStore, PlatformClinicStore>();
        services.AddScoped<IIdentityStore, IdentityStore>();
        services.AddScoped<IPatientStore, PatientStore>();
        services.AddScoped<DoctorStore>();
        services.AddScoped<IDoctorProfileStore>(x => x.GetRequiredService<DoctorStore>());
        services.AddScoped<IDoctorScheduleStore>(x => x.GetRequiredService<DoctorStore>());
        services.AddScoped<IDoctorCompensationStore>(x => x.GetRequiredService<DoctorStore>());
        services.AddScoped<IAppointmentStore, AppointmentStore>();
        services.AddScoped<DentalClinic.Application.PublicBooking.IPublicBookingStore, DentalClinic.Infrastructure.Persistence.PublicBookingStore>();
        services.AddScoped<IDentalStore, DentalStore>();
        services.AddScoped<ITreatmentStore, TreatmentStore>();
        services.AddScoped<IPrescriptionStore, PrescriptionStore>();
        services.AddScoped<ICrmStore, CrmStore>();
        services.AddScoped<IFinanceStore, FinanceStore>();
        services.AddScoped<IReportStore, ReportStore>();
        services.AddScoped<DentalClinic.Application.Notifications.INotificationStore, DentalClinic.Infrastructure.Persistence.NotificationStore>();
        services.AddScoped<IInventoryStore, InventoryStore>();
        services.AddScoped<IPharmacyStore, PharmacyStore>();
        services.AddScoped<ISettingsStore, SettingsStore>();
        services.AddScoped<DentalClinic.Infrastructure.Notifications.INotificationProvider, DentalClinic.Infrastructure.Notifications.EmailNotificationProvider>();
        services.AddScoped<DentalClinic.Infrastructure.Notifications.INotificationProvider, DentalClinic.Infrastructure.Notifications.SmsNotificationProvider>();
        services.AddScoped<DentalClinic.Infrastructure.Notifications.INotificationProvider, DentalClinic.Infrastructure.Notifications.WhatsAppNotificationProvider>();
        services.AddScoped<DentalClinic.Infrastructure.Notifications.INotificationProvider, DentalClinic.Infrastructure.Notifications.InAppNotificationProvider>();
        services.AddScoped<ICsvExportService, CsvExportService>();
        services.AddSingleton<IPrescriptionReferenceGenerator, SecurePrescriptionReferenceGenerator>();
        services.AddSingleton<IPrescriptionQrCodeService, PrescriptionQrCodeService>();
        services.AddSingleton<IPrescriptionDocumentService, PrescriptionDocumentService>();
        services.AddSingleton<ISpeechToTextService, UnconfiguredSpeechToTextService>();
        services.AddScoped<IClinicAdminIdentityService, ClinicAdminIdentityService>();
        services.AddScoped<IIdentityCredentialService, ClinicAdminIdentityService>();
        services.AddSingleton<IInvitationTokenGenerator, SecureInvitationTokenGenerator>();
        services.AddScoped<IClinicInvitationNotifier, LoggingClinicInvitationNotifier>();
        services.AddSingleton<ISystemClock, SystemClock>();
        services.AddHttpContextAccessor();
        services.AddScoped<IPlatformAccessContext, HttpPlatformAccessContext>();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(postgres, npgsql =>
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 12;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager();

        services.AddSingleton(NpgsqlDataSource.Create(postgres));
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redis));
        services.AddStackExchangeRedisCache(options => options.Configuration = redis);

        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"])
            .AddCheck<PostgresHealthCheck>("postgres", tags: ["ready"])
            .AddCheck<RedisHealthCheck>("redis", tags: ["ready"]);

        return services;
    }
}
