using DentalClinic.Application.Common.Security;
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
        services.AddScoped<ITenantInitializer, FinanceTenantInitializer>();
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
        services.AddScoped<AppointmentAccess>();
        services.AddScoped<AppointmentSchedulingValidator>();
        services.AddScoped<IAppointmentQueries, AppointmentQueries>();
        services.AddScoped<IAppointmentAvailabilityQuery, AppointmentAvailabilityQuery>();
        services.AddScoped<ICreateAppointment, CreateAppointment>();
        services.AddScoped<IRescheduleAppointment, RescheduleAppointment>();
        services.AddScoped<IAppointmentLifecycle, AppointmentLifecycle>();
        services.AddScoped<IDentalQueries, DentalQueries>();
        services.AddScoped<IExaminationCommands, ExaminationCommands>();
        services.AddScoped<TreatmentAccess>();
        services.AddScoped<ITreatmentCatalogService, TreatmentCatalogService>();
        services.AddScoped<ITreatmentPlanService, TreatmentPlanService>();
        services.AddScoped<ITreatmentService, TreatmentService>();
        services.AddScoped<PrescriptionAccess>();
        services.AddScoped<IMedicationCatalogService, MedicationCatalogService>();
        services.AddScoped<IPrescriptionService, PrescriptionService>();
        services.AddScoped<IFollowUpQueries, FollowUpQueries>();
        services.AddScoped<ICreateFollowUp, CreateFollowUp>();
        services.AddScoped<IFollowUpCreator>(x => (CreateFollowUp)x.GetRequiredService<ICreateFollowUp>());
        services.AddScoped<IUpdateFollowUp, UpdateFollowUp>();
        services.AddScoped<IAssignFollowUp, AssignFollowUp>();
        services.AddScoped<IFollowUpLifecycle, FollowUpLifecycle>();
        services.AddScoped<ICommunicationActivityService, CommunicationActivityService>();
        services.AddScoped<IFinanceQueries, FinanceQueries>();
        services.AddScoped<IFinancialCategoryService, FinancialCategoryService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IExpenseService, ExpenseService>();
        services.AddScoped<ITreatmentRevenueCreator, TreatmentRevenueCreator>();
        services.AddSingleton<IDoctorCompensationCalculator, DoctorCompensationCalculator>();
        services.AddScoped<IReportServices, ReportServices>();
        return services;
    }
}
