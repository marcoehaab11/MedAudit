using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase6AppointmentsAndScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConfirmedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CheckedInAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_appointments", x => x.Id);
                    table.UniqueConstraint("AK_appointments_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_appointments_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_appointments_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_appointments_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_CreatedBy",
                table: "appointments",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_DoctorProfileId_StartAt",
                table: "appointments",
                columns: new[] { "TenantId", "DoctorProfileId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_PatientId_StartAt",
                table: "appointments",
                columns: new[] { "TenantId", "PatientId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_StartAt",
                table: "appointments",
                columns: new[] { "TenantId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_Status_StartAt",
                table: "appointments",
                columns: new[] { "TenantId", "Status", "StartAt" });

            migrationBuilder.Sql(
                """
                ALTER TABLE appointments ADD CONSTRAINT "CK_appointments_timing"
                    CHECK ("StartAt" < "EndAt" AND "EndAt" = "StartAt" + "DurationMinutes" * interval '1 minute');
                ALTER TABLE appointments ADD CONSTRAINT "CK_appointments_duration"
                    CHECK ("DurationMinutes" BETWEEN 5 AND 480);
                ALTER TABLE appointments ADD CONSTRAINT "CK_appointments_type" CHECK ("Type" BETWEEN 1 AND 6);
                ALTER TABLE appointments ADD CONSTRAINT "CK_appointments_status" CHECK ("Status" BETWEEN 1 AND 7);
                CREATE EXTENSION IF NOT EXISTS btree_gist;
                ALTER TABLE appointments ADD CONSTRAINT "EX_appointments_doctor_overlap"
                    EXCLUDE USING gist ("TenantId" WITH =, "DoctorProfileId" WITH =,
                    tstzrange("StartAt", "EndAt", '[)') WITH &&) WHERE ("Status" <> 6);
                ALTER TABLE appointments ADD CONSTRAINT "EX_appointments_patient_overlap"
                    EXCLUDE USING gist ("TenantId" WITH =, "PatientId" WITH =,
                    tstzrange("StartAt", "EndAt", '[)') WITH &&) WHERE ("Status" <> 6);

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Appointments.CheckIn'), ('Appointments.Start'),
                    ('Appointments.Complete'), ('Appointments.MarkNoShow')) AS permission(name)
                WHERE role."NormalizedName" = 'CLINICADMIN'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Appointments.CheckIn'), ('Appointments.MarkNoShow')) AS permission(name)
                WHERE role."NormalizedName" = 'RECEPTIONIST'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Appointments.Start'), ('Appointments.Complete')) AS permission(name)
                WHERE role."NormalizedName" = 'DOCTOR'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                DELETE FROM role_permissions AS role_permission USING tenant_roles AS role
                WHERE role_permission."RoleId" = role."Id" AND role_permission."TenantId" = role."TenantId"
                    AND role."NormalizedName" = 'DOCTOR'
                    AND role_permission."Permission" IN ('Appointments.Create', 'Appointments.Edit');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions AS role_permission USING tenant_roles AS role
                WHERE role_permission."RoleId" = role."Id" AND role_permission."TenantId" = role."TenantId"
                    AND role_permission."Permission" IN ('Appointments.CheckIn', 'Appointments.Start',
                        'Appointments.Complete', 'Appointments.MarkNoShow');
                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Appointments.Create'), ('Appointments.Edit')) AS permission(name)
                WHERE role."NormalizedName" = 'DOCTOR'
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
            migrationBuilder.DropTable(
                name: "appointments");
        }
    }
}
