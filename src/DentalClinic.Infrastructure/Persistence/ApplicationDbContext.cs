using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Common;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Doctors;
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

            if ((Guid)property.CurrentValue! != tenantId ||
                (entry.State == EntityState.Modified && property.IsModified))
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
