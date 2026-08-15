using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Common;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Domain.Crm;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

public sealed class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    ICurrentTenant currentTenant,
    PlatformWriteScope? platformWriteScope = null)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<TenantConfiguration> TenantConfigurations => Set<TenantConfiguration>();
    public DbSet<AdminInvitation> AdminInvitations => Set<AdminInvitation>();
    public DbSet<PlatformAuditLog> PlatformAuditLogs => Set<PlatformAuditLog>();
    public DbSet<ClinicUser> ClinicUsers => Set<ClinicUser>();
    public DbSet<TenantRole> TenantRoles => Set<TenantRole>();
    public DbSet<RolePermissionGrant> RolePermissions => Set<RolePermissionGrant>();
    public DbSet<UserRoleAssignment> UserRoleAssignments => Set<UserRoleAssignment>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientAllergy> PatientAllergies => Set<PatientAllergy>();
    public DbSet<PatientMedicalCondition> PatientMedicalConditions => Set<PatientMedicalCondition>();
    public DbSet<PatientMedication> PatientMedications => Set<PatientMedication>();
    public DbSet<PatientSurgery> PatientSurgeries => Set<PatientSurgery>();
    public DbSet<PatientNumberSequence> PatientNumberSequences => Set<PatientNumberSequence>();
    public DbSet<DoctorProfile> DoctorProfiles => Set<DoctorProfile>();
    public DbSet<DoctorSchedule> DoctorSchedules => Set<DoctorSchedule>();
    public DbSet<DoctorScheduleBreak> DoctorScheduleBreaks => Set<DoctorScheduleBreak>();
    public DbSet<DoctorCompensation> DoctorCompensations => Set<DoctorCompensation>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Examination> Examinations => Set<Examination>();
    public DbSet<DentalFinding> DentalFindings => Set<DentalFinding>();
    public DbSet<DentalFindingSurface> DentalFindingSurfaces => Set<DentalFindingSurface>();
    public DbSet<DentalProcedure> DentalProcedures => Set<DentalProcedure>();
    public DbSet<DentalProcedureSurface> DentalProcedureSurfaces => Set<DentalProcedureSurface>();
    public DbSet<EndodonticRecord> EndodonticRecords => Set<EndodonticRecord>();
    public DbSet<EndodonticCanal> EndodonticCanals => Set<EndodonticCanal>();
    public DbSet<TreatmentCatalogItem> TreatmentCatalogItems => Set<TreatmentCatalogItem>();
    public DbSet<TreatmentPlan> TreatmentPlans => Set<TreatmentPlan>();
    public DbSet<TreatmentPlanItem> TreatmentPlanItems => Set<TreatmentPlanItem>();
    public DbSet<Treatment> Treatments => Set<Treatment>();
    public DbSet<TreatmentTooth> TreatmentTeeth => Set<TreatmentTooth>();
    public DbSet<MedicationCatalogItem> MedicationCatalogItems => Set<MedicationCatalogItem>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
    public DbSet<PrescriptionNumberSequence> PrescriptionNumberSequences => Set<PrescriptionNumberSequence>();
    public DbSet<FollowUp> FollowUps => Set<FollowUp>();
    public DbSet<CommunicationActivity> CommunicationActivities => Set<CommunicationActivity>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Tenant>(entity =>
        {
            entity.ToTable("tenants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Address).HasMaxLength(500).IsRequired();
            entity.Property(x => x.City).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Country).HasMaxLength(100).IsRequired();
            entity.Property(x => x.TimeZone).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            entity.Property(x => x.LogoReference).HasMaxLength(500);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => x.Status);
        });

        builder.Entity<AdminInvitation>(entity =>
        {
            entity.ToTable("admin_invitations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(100).IsRequired();
            entity.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<ClinicUser>(entity =>
        {
            entity.ToTable("clinic_users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DisplayName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Phone).HasMaxLength(50);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ApplicationUser>().WithOne().HasForeignKey<ClinicUser>(x => x.Id).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<TenantRole>(entity =>
        {
            entity.ToTable("tenant_roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
            entity.Property(x => x.NormalizedName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.NormalizedName }).IsUnique();
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<RolePermissionGrant>(entity =>
        {
            entity.ToTable("role_permissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Permission).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.RoleId, x.Permission }).IsUnique();
            entity.HasOne<TenantRole>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<UserRoleAssignment>(entity =>
        {
            entity.ToTable("user_role_assignments");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.UserId, x.RoleId }).IsUnique();
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<TenantRole>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<Patient>(entity =>
        {
            entity.ToTable("patients");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PatientNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.MiddleName).HasMaxLength(100);
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Gender).HasConversion<int>();
            entity.Property(x => x.Phone).HasMaxLength(50).IsRequired();
            entity.Property(x => x.AlternatePhone).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(256);
            entity.Property(x => x.Address).HasMaxLength(500);
            entity.Property(x => x.City).HasMaxLength(100);
            entity.Property(x => x.Country).HasMaxLength(100);
            entity.Property(x => x.EmergencyContactName).HasMaxLength(200);
            entity.Property(x => x.EmergencyContactPhone).HasMaxLength(50);
            entity.Property(x => x.Nationality).HasMaxLength(100);
            entity.Property(x => x.Occupation).HasMaxLength(150);
            entity.Property(x => x.MaritalStatus).HasConversion<int?>();
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.MedicalNotes).HasMaxLength(4000);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.HasIndex(x => new { x.TenantId, x.PatientNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.Phone });
            entity.HasIndex(x => new { x.TenantId, x.LastName, x.FirstName });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<PatientAllergy>(entity => ConfigureMedicalRecord(
            entity, "patient_allergies", nameLength: 200));

        builder.Entity<PatientMedicalCondition>(entity => ConfigureMedicalRecord(
            entity, "patient_medical_conditions", nameLength: 200));

        builder.Entity<PatientMedication>(entity =>
        {
            entity.ToTable("patient_medications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Dosage).HasMaxLength(200);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId });
            entity.HasOne<Patient>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<PatientSurgery>(entity =>
        {
            entity.ToTable("patient_surgeries");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Procedure).HasMaxLength(300).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId });
            entity.HasOne<Patient>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<PatientNumberSequence>(entity =>
        {
            entity.ToTable("patient_number_sequences");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Prefix).HasMaxLength(10).IsRequired();
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DoctorProfile>(entity =>
        {
            entity.ToTable("doctor_profiles");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.Specialization).HasMaxLength(150).IsRequired();
            entity.Property(x => x.LicenseNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Bio).HasMaxLength(2000);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.HasIndex(x => new { x.TenantId, x.ClinicUserId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.LicenseNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.Status, x.Specialization });
            entity.HasOne<ClinicUser>().WithOne()
                .HasForeignKey<DoctorProfile>(x => new { x.TenantId, x.ClinicUserId })
                .HasPrincipalKey<ClinicUser>(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DoctorSchedule>(entity =>
        {
            entity.ToTable("doctor_schedules");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.DayOfWeek).HasConversion<int>();
            entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.DayOfWeek, x.StartTime });
            entity.HasOne<DoctorProfile>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.DoctorProfileId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Breaks).WithOne()
                .HasForeignKey(x => new { x.TenantId, x.DoctorScheduleId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Breaks).UsePropertyAccessMode(
                Microsoft.EntityFrameworkCore.PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DoctorScheduleBreak>(entity =>
        {
            entity.ToTable("doctor_schedule_breaks");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.TenantId, x.DoctorScheduleId, x.StartTime });
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DoctorCompensation>(entity =>
        {
            entity.ToTable("doctor_compensations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CompensationType).HasConversion<int>();
            entity.Property(x => x.FixedAmount).HasPrecision(18, 2);
            entity.Property(x => x.Percentage).HasPrecision(5, 2);
            entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.EffectiveFrom });
            entity.HasOne<DoctorProfile>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.DoctorProfileId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<Appointment>(entity =>
        {
            entity.ToTable("appointments");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.Type).HasConversion<int>();
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.CancellationReason).HasMaxLength(500);
            entity.HasIndex(x => new { x.TenantId, x.StartAt });
            entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.StartAt });
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.StartAt });
            entity.HasIndex(x => new { x.TenantId, x.Status, x.StartAt });
            entity.HasOne<Patient>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DoctorProfile>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.DoctorProfileId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany()
                .HasForeignKey(x => new { x.TenantId, x.CreatedBy })
                .HasPrincipalKey(x => new { x.TenantId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<Examination>(entity =>
        {
            entity.ToTable("examinations"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.TenantId, x.AppointmentId }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.CreatedAt });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Appointment>().WithMany().HasForeignKey(x => new { x.TenantId, x.AppointmentId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.DoctorUserId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedBy })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Findings).WithOne().HasForeignKey(x => new { x.TenantId, x.ExaminationId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Procedures).WithOne().HasForeignKey(x => new { x.TenantId, x.ExaminationId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.EndodonticRecords).WithOne().HasForeignKey(x => new { x.TenantId, x.ExaminationId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Findings).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Navigation(x => x.Procedures).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.Navigation(x => x.EndodonticRecords).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DentalFinding>(entity =>
        {
            entity.ToTable("dental_findings"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.FindingType).HasConversion<int>(); entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.ToothNumber, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.ExaminationId });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedBy })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Surfaces).WithOne().HasForeignKey(x => new { x.TenantId, x.FindingId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Surfaces).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<DentalFindingSurface>(entity =>
        {
            entity.ToTable("dental_finding_surfaces"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Surface).HasConversion<int>();
            entity.HasIndex(x => new { x.TenantId, x.FindingId, x.Surface }).IsUnique();
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<DentalProcedure>(entity =>
        {
            entity.ToTable("dental_procedures"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.ProcedureType).HasConversion<int>(); entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.ToothNumber, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.ExaminationId });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedBy })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Surfaces).WithOne().HasForeignKey(x => new { x.TenantId, x.ProcedureId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Surfaces).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<DentalProcedureSurface>(entity =>
        {
            entity.ToTable("dental_procedure_surfaces"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Surface).HasConversion<int>();
            entity.HasIndex(x => new { x.TenantId, x.ProcedureId, x.Surface }).IsUnique();
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<EndodonticRecord>(entity =>
        {
            entity.ToTable("endodontic_records"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.ToothNumber, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.ExaminationId });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedBy })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Canals).WithOne().HasForeignKey(x => new { x.TenantId, x.EndodonticRecordId })
                .HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Canals).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<EndodonticCanal>(entity =>
        {
            entity.ToTable("endodontic_canals"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Name).HasMaxLength(50).IsRequired(); entity.Property(x => x.LengthMm).HasPrecision(5, 2);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.EndodonticRecordId, x.Name }).IsUnique();
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<TreatmentCatalogItem>(entity =>
        {
            entity.ToTable("treatment_catalog_items"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever(); entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.Type).HasConversion<int>(); entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired(); entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.DefaultPrice).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); entity.HasIndex(x => new { x.TenantId, x.IsActive, x.Name });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<TreatmentPlan>(entity =>
        {
            entity.ToTable("treatment_plans"); entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever(); entity.HasAlternateKey(x => new { x.TenantId, x.Id });
            entity.Property(x => x.Title).HasMaxLength(250).IsRequired(); entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.Status).HasConversion<int>(); entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2); entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.Status, x.CreatedAt });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DoctorProfile>().WithMany().HasForeignKey(x => new { x.TenantId, x.DoctorProfileId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => new { x.TenantId, x.TreatmentPlanId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<TreatmentPlanItem>(entity =>
        {
            entity.ToTable("treatment_plan_items"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.TreatmentType).HasConversion<int>();
            entity.Property(x => x.TreatmentName).HasMaxLength(200).IsRequired(); entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2); entity.Property(x => x.Total).HasPrecision(18, 2); entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.TreatmentPlanId }); entity.HasIndex(x => new { x.TenantId, x.TreatmentCatalogItemId });
            entity.HasOne<TreatmentCatalogItem>().WithMany().HasForeignKey(x => new { x.TenantId, x.TreatmentCatalogItemId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<Treatment>(entity =>
        {
            entity.ToTable("treatments"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.Type).HasConversion<int>();
            entity.Property(x => x.TreatmentName).HasMaxLength(200).IsRequired(); entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.Price).HasPrecision(18, 2); entity.Property(x => x.Notes).HasMaxLength(4000); entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.CreatedAt }); entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.Status, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.AppointmentId }); entity.HasIndex(x => new { x.TenantId, x.TreatmentPlanItemId });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DoctorProfile>().WithMany().HasForeignKey(x => new { x.TenantId, x.DoctorProfileId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<TreatmentCatalogItem>().WithMany().HasForeignKey(x => new { x.TenantId, x.TreatmentCatalogItemId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Appointment>().WithMany().HasForeignKey(x => new { x.TenantId, x.AppointmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<TreatmentPlan>().WithMany().HasForeignKey(x => new { x.TenantId, x.TreatmentPlanId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<TreatmentPlanItem>().WithMany().HasForeignKey(x => new { x.TenantId, x.TreatmentPlanItemId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DentalProcedure>().WithMany().HasForeignKey(x => new { x.TenantId, x.SourceDentalProcedureId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Teeth).WithOne().HasForeignKey(x => new { x.TenantId, x.TreatmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Teeth).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<TreatmentTooth>(entity =>
        {
            entity.ToTable("treatment_teeth"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasIndex(x => new { x.TenantId, x.TreatmentId, x.ToothNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.ToothNumber });
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<MedicationCatalogItem>(entity =>
        {
            entity.ToTable("medication_catalog_items"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.GenericName).HasMaxLength(200); entity.Property(x => x.Strength).HasMaxLength(100);
            entity.Property(x => x.Form).HasConversion<int?>(); entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.IsActive, x.Name }); entity.HasIndex(x => new { x.TenantId, x.GenericName });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<Prescription>(entity =>
        {
            entity.ToTable("prescriptions"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.PrescriptionNumber).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>(); entity.Property(x => x.Notes).HasMaxLength(4000);
            entity.Property(x => x.DocumentReference).HasMaxLength(100); entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.TenantId, x.PrescriptionNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.PatientId, x.CreatedAt }); entity.HasIndex(x => new { x.TenantId, x.DoctorProfileId, x.CreatedAt });
            entity.HasIndex(x => new { x.TenantId, x.Status, x.CreatedAt }); entity.HasIndex(x => x.DocumentReference).IsUnique();
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<DoctorProfile>().WithMany().HasForeignKey(x => new { x.TenantId, x.DoctorProfileId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Appointment>().WithMany().HasForeignKey(x => new { x.TenantId, x.AppointmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Examination>().WithMany().HasForeignKey(x => new { x.TenantId, x.ExaminationId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Treatment>().WithMany().HasForeignKey(x => new { x.TenantId, x.TreatmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedBy }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.IssuedBy }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(x => x.Items).WithOne().HasForeignKey(x => new { x.TenantId, x.PrescriptionId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(x => x.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<PrescriptionItem>(entity =>
        {
            entity.ToTable("prescription_items"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.MedicationNameSnapshot).HasMaxLength(200).IsRequired(); entity.Property(x => x.GenericNameSnapshot).HasMaxLength(200);
            entity.Property(x => x.StrengthSnapshot).HasMaxLength(100); entity.Property(x => x.FormSnapshot).HasConversion<int?>();
            entity.Property(x => x.Dose).HasMaxLength(100).IsRequired(); entity.Property(x => x.Frequency).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Duration).HasMaxLength(100).IsRequired(); entity.Property(x => x.Route).HasMaxLength(100);
            entity.Property(x => x.Instructions).HasMaxLength(1000).IsRequired(); entity.HasIndex(x => new { x.TenantId, x.PrescriptionId, x.SortOrder });
            entity.HasOne<MedicationCatalogItem>().WithMany().HasForeignKey(x => new { x.TenantId, x.MedicationId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });
        builder.Entity<PrescriptionNumberSequence>(entity =>
        {
            entity.ToTable("prescription_number_sequences"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasIndex(x => x.TenantId).IsUnique(); entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<FollowUp>(entity =>
        {
            entity.ToTable("follow_ups"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.HasAlternateKey(x => new { x.TenantId, x.Id }); entity.Property(x => x.Type).HasConversion<int>();
            entity.Property(x => x.Status).HasConversion<int>(); entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(2000); entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasIndex(x => new { x.TenantId, x.PatientId }); entity.HasIndex(x => new { x.TenantId, x.Status });
            entity.HasIndex(x => new { x.TenantId, x.DueAt }); entity.HasIndex(x => new { x.TenantId, x.AssignedToUserId });
            entity.HasIndex(x => new { x.TenantId, x.Type }); entity.HasIndex(x => new { x.TenantId, x.CreatedAt });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.AssignedToUserId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.CreatedByUserId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Appointment>().WithMany().HasForeignKey(x => new { x.TenantId, x.RelatedAppointmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<TreatmentPlan>().WithMany().HasForeignKey(x => new { x.TenantId, x.RelatedTreatmentPlanId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Treatment>().WithMany().HasForeignKey(x => new { x.TenantId, x.RelatedTreatmentId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Prescription>().WithMany().HasForeignKey(x => new { x.TenantId, x.RelatedPrescriptionId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<CommunicationActivity>(entity =>
        {
            entity.ToTable("communication_activities"); entity.HasKey(x => x.Id); entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Type).HasConversion<int>(); entity.Property(x => x.Direction).HasConversion<int>();
            entity.Property(x => x.Subject).HasMaxLength(200); entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => new { x.TenantId, x.PatientId }); entity.HasIndex(x => new { x.TenantId, x.OccurredAt });
            entity.HasOne<Patient>().WithMany().HasForeignKey(x => new { x.TenantId, x.PatientId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ClinicUser>().WithMany().HasForeignKey(x => new { x.TenantId, x.UserId }).HasPrincipalKey(x => new { x.TenantId, x.Id }).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<PlatformAuditLog>(entity =>
        {
            entity.ToTable("platform_audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Action).HasConversion<int>();
            entity.Property(x => x.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.CorrelationId).HasMaxLength(100);
            entity.HasIndex(x => new { x.TenantId, x.OccurredAt });
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<TenantConfiguration>(entity =>
        {
            entity.ToTable("tenant_configurations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Culture).HasMaxLength(10).IsRequired();
            entity.Property(x => x.TimeZone).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            entity.HasIndex(x => x.TenantId).IsUnique();
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
        });

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(x => x.TenantId);
            entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
            entity.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        EnforceTenantBoundary();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        EnforceTenantBoundary();
        return base.SaveChanges();
    }

    private void EnforceTenantBoundary()
    {
        foreach (var entry in ChangeTracker.Entries<ITenantOwned>()
                     .Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            var tenantId = currentTenant.IsAvailable
                ? currentTenant.RequireTenantId()
                : platformWriteScope?.TenantId
                    ?? throw new TenantUnavailableException();
            var property = entry.Property(nameof(ITenantOwned.TenantId));

            if (entry.State == EntityState.Added && (Guid)property.CurrentValue! == Guid.Empty)
            {
                property.CurrentValue = tenantId;
            }

            var currentValue = (Guid)property.CurrentValue!;
            var tenantWasChanged = entry.State == EntityState.Modified && property.IsModified &&
                (Guid)property.OriginalValue! != currentValue;
            if (currentValue != tenantId || tenantWasChanged)
            {
                throw new ForbiddenAccessException("Cross-tenant persistence is forbidden.");
            }
        }
    }

    private void ConfigureMedicalRecord<TEntity>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> entity,
        string table,
        int nameLength)
        where TEntity : TenantOwnedEntity
    {
        entity.ToTable(table);
        entity.HasKey(x => x.Id);
        entity.Property("Name").HasMaxLength(nameLength).IsRequired();
        entity.Property("Notes").HasMaxLength(1000);
        entity.HasIndex(nameof(ITenantOwned.TenantId), "PatientId");
        entity.HasOne<Patient>().WithMany()
            .HasForeignKey(nameof(ITenantOwned.TenantId), "PatientId")
            .HasPrincipalKey(nameof(ITenantOwned.TenantId), nameof(TenantOwnedEntity.Id))
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasQueryFilter(x => currentTenant.IsAvailable && x.TenantId == currentTenant.TenantId);
    }
}
