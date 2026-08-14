using DentalClinic.Application.Common.Security;
using DentalClinic.Application.Tenants;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Doctors;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(
            typeof(DependencyInjection).Assembly,
            includeInternalTypes: true);
        services.AddScoped<ITenantGuard, TenantGuard>();
        services.AddScoped<IClinicManagementService, ClinicManagementService>();
        services.AddScoped<ITenantInitializer, CoreTenantInitializer>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IInvitationService, InvitationService>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();
        services.AddScoped<IPlatformUserInspectionService, PlatformUserInspectionService>();
        services.AddScoped<IPatientQueries, PatientQueries>();
        services.AddScoped<IPatientCommands, PatientCommandsService>();
        services.AddScoped<IPatientMedicalCommands, PatientMedicalCommands>();
        services.AddScoped<IDoctorProfileQueries, DoctorProfileQueries>();
        services.AddScoped<IDoctorProfileCommands, DoctorProfileCommands>();
        services.AddScoped<IDoctorScheduleService, DoctorScheduleService>();
        services.AddScoped<IDoctorCompensationService, DoctorCompensationService>();
        return services;
    }
}
