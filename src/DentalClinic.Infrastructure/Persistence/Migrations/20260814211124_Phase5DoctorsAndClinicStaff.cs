using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase5DoctorsAndClinicStaff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_clinic_users_TenantId_Id",
                table: "clinic_users",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.CreateTable(
                name: "doctor_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Specialization = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    LicenseNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Bio = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ConsultationDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_profiles", x => x.Id);
                    table.UniqueConstraint("AK_doctor_profiles_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_doctor_profiles_clinic_users_TenantId_ClinicUserId",
                        columns: x => new { x.TenantId, x.ClinicUserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "doctor_compensations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompensationType = table.Column<int>(type: "integer", nullable: false),
                    FixedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Percentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_compensations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_doctor_compensations_doctor_profiles_TenantId_DoctorProfile~",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "doctor_schedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    SlotDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_schedules", x => x.Id);
                    table.UniqueConstraint("AK_doctor_schedules_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_doctor_schedules_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "doctor_schedule_breaks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_schedule_breaks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_doctor_schedule_breaks_doctor_schedules_TenantId_DoctorSche~",
                        columns: x => new { x.TenantId, x.DoctorScheduleId },
                        principalTable: "doctor_schedules",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensations_TenantId_DoctorProfileId_EffectiveFrom",
                table: "doctor_compensations",
                columns: new[] { "TenantId", "DoctorProfileId", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_profiles_TenantId_ClinicUserId",
                table: "doctor_profiles",
                columns: new[] { "TenantId", "ClinicUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_doctor_profiles_TenantId_LicenseNumber",
                table: "doctor_profiles",
                columns: new[] { "TenantId", "LicenseNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_doctor_profiles_TenantId_Status_Specialization",
                table: "doctor_profiles",
                columns: new[] { "TenantId", "Status", "Specialization" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_schedule_breaks_TenantId_DoctorScheduleId_StartTime",
                table: "doctor_schedule_breaks",
                columns: new[] { "TenantId", "DoctorScheduleId", "StartTime" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_schedules_TenantId_DoctorProfileId_DayOfWeek_StartTi~",
                table: "doctor_schedules",
                columns: new[] { "TenantId", "DoctorProfileId", "DayOfWeek", "StartTime" });

            migrationBuilder.Sql(
                """
                CREATE EXTENSION IF NOT EXISTS btree_gist;

                ALTER TABLE doctor_schedules ADD CONSTRAINT "CK_doctor_schedules_times"
                    CHECK ("StartTime" < "EndTime" AND "SlotDurationMinutes" > 0);
                ALTER TABLE doctor_schedule_breaks ADD CONSTRAINT "CK_doctor_schedule_breaks_times"
                    CHECK ("StartTime" < "EndTime");
                ALTER TABLE doctor_compensations ADD CONSTRAINT "CK_doctor_compensations_dates"
                    CHECK ("EffectiveTo" IS NULL OR "EffectiveTo" >= "EffectiveFrom");
                ALTER TABLE doctor_compensations ADD CONSTRAINT "CK_doctor_compensations_values"
                    CHECK (
                        ("CompensationType" = 1 AND "FixedAmount" > 0 AND COALESCE("Percentage", 0) = 0) OR
                        ("CompensationType" = 2 AND "Percentage" > 0 AND "Percentage" <= 100 AND COALESCE("FixedAmount", 0) = 0) OR
                        ("CompensationType" = 3 AND "FixedAmount" > 0 AND "Percentage" > 0 AND "Percentage" <= 100));
                ALTER TABLE doctor_compensations ADD CONSTRAINT "EX_doctor_compensations_effective_period"
                    EXCLUDE USING gist (
                        "TenantId" WITH =,
                        "DoctorProfileId" WITH =,
                        daterange("EffectiveFrom", COALESCE("EffectiveTo", 'infinity'::date), '[]') WITH &&);

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('Doctors.View'), ('Doctors.Create'), ('Doctors.Edit'), ('Doctors.Archive'),
                    ('Doctors.ManageSchedule'), ('Doctors.ManageCompensation')) AS permission(name)
                WHERE role."NormalizedName" = 'CLINICADMIN'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", 'Doctors.View', role."TenantId"
                FROM tenant_roles AS role
                WHERE role."NormalizedName" = 'DOCTOR'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions
                WHERE "Permission" IN (
                    'Doctors.View', 'Doctors.Create', 'Doctors.Edit', 'Doctors.Archive',
                    'Doctors.ManageSchedule', 'Doctors.ManageCompensation');
                """);
            migrationBuilder.DropTable(
                name: "doctor_compensations");

            migrationBuilder.DropTable(
                name: "doctor_schedule_breaks");

            migrationBuilder.DropTable(
                name: "doctor_schedules");

            migrationBuilder.DropTable(
                name: "doctor_profiles");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_clinic_users_TenantId_Id",
                table: "clinic_users");
        }
    }
}
