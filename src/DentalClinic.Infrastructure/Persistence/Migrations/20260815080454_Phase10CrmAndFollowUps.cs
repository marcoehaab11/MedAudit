using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase10CrmAndFollowUps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "communication_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    Subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_communication_activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_communication_activities_clinic_users_TenantId_UserId",
                        columns: x => new { x.TenantId, x.UserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_communication_activities_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "follow_ups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RelatedAppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedTreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedTreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    RelatedPrescriptionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_follow_ups", x => x.Id);
                    table.UniqueConstraint("AK_follow_ups_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_follow_ups_appointments_TenantId_RelatedAppointmentId",
                        columns: x => new { x.TenantId, x.RelatedAppointmentId },
                        principalTable: "appointments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_clinic_users_TenantId_AssignedToUserId",
                        columns: x => new { x.TenantId, x.AssignedToUserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_clinic_users_TenantId_CreatedByUserId",
                        columns: x => new { x.TenantId, x.CreatedByUserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_prescriptions_TenantId_RelatedPrescriptionId",
                        columns: x => new { x.TenantId, x.RelatedPrescriptionId },
                        principalTable: "prescriptions",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_treatment_plans_TenantId_RelatedTreatmentPlanId",
                        columns: x => new { x.TenantId, x.RelatedTreatmentPlanId },
                        principalTable: "treatment_plans",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_follow_ups_treatments_TenantId_RelatedTreatmentId",
                        columns: x => new { x.TenantId, x.RelatedTreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_communication_activities_TenantId_OccurredAt",
                table: "communication_activities",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_communication_activities_TenantId_PatientId",
                table: "communication_activities",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_communication_activities_TenantId_UserId",
                table: "communication_activities",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_AssignedToUserId",
                table: "follow_ups",
                columns: new[] { "TenantId", "AssignedToUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_CreatedAt",
                table: "follow_ups",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_CreatedByUserId",
                table: "follow_ups",
                columns: new[] { "TenantId", "CreatedByUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_DueAt",
                table: "follow_ups",
                columns: new[] { "TenantId", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_PatientId",
                table: "follow_ups",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_RelatedAppointmentId",
                table: "follow_ups",
                columns: new[] { "TenantId", "RelatedAppointmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_RelatedPrescriptionId",
                table: "follow_ups",
                columns: new[] { "TenantId", "RelatedPrescriptionId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_RelatedTreatmentId",
                table: "follow_ups",
                columns: new[] { "TenantId", "RelatedTreatmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_RelatedTreatmentPlanId",
                table: "follow_ups",
                columns: new[] { "TenantId", "RelatedTreatmentPlanId" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_Status",
                table: "follow_ups",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_follow_ups_TenantId_Type",
                table: "follow_ups",
                columns: new[] { "TenantId", "Type" });

            migrationBuilder.AddCheckConstraint("CK_communication_activities_type", "communication_activities", "\"Type\" BETWEEN 1 AND 5");
            migrationBuilder.AddCheckConstraint("CK_communication_activities_direction", "communication_activities", "\"Direction\" BETWEEN 1 AND 2");
            migrationBuilder.AddCheckConstraint("CK_follow_ups_type", "follow_ups", "\"Type\" BETWEEN 1 AND 8");
            migrationBuilder.AddCheckConstraint("CK_follow_ups_status", "follow_ups", "\"Status\" BETWEEN 1 AND 4");
            migrationBuilder.AddCheckConstraint("CK_follow_ups_terminal_dates", "follow_ups",
                "(\"Status\" = 3 AND \"CompletedAt\" IS NOT NULL AND \"CancelledAt\" IS NULL) OR (\"Status\" = 4 AND \"CancelledAt\" IS NOT NULL AND \"CompletedAt\" IS NULL) OR (\"Status\" IN (1,2) AND \"CompletedAt\" IS NULL AND \"CancelledAt\" IS NULL)");

            migrationBuilder.Sql(
                """
                CREATE FUNCTION protect_terminal_follow_up() RETURNS trigger AS $$
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        IF OLD."Status" IN (3,4) THEN RAISE EXCEPTION 'Terminal follow-ups cannot be deleted'; END IF;
                        RETURN OLD;
                    END IF;
                    IF OLD."Status" IN (3,4) AND NEW IS DISTINCT FROM OLD THEN
                        RAISE EXCEPTION 'Terminal follow-ups are immutable';
                    END IF;
                    IF OLD."Status" = 2 AND NEW."Status" NOT IN (2,3,4) THEN
                        RAISE EXCEPTION 'Invalid follow-up state transition';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER follow_up_terminal_guard BEFORE UPDATE OR DELETE ON follow_ups
                    FOR EACH ROW EXECUTE FUNCTION protect_terminal_follow_up();

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('CRM.View'), ('CRM.CreateFollowUp'), ('CRM.EditFollowUp'), ('CRM.AssignFollowUp'),
                    ('CRM.CompleteFollowUp'), ('CRM.CancelFollowUp'), ('CRM.ViewActivities'), ('CRM.CreateActivity')) AS permission(name)
                WHERE role."NormalizedName" IN ('CLINICADMIN','RECEPTIONIST')
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions WHERE "Permission" LIKE 'CRM.%';
                DROP TRIGGER IF EXISTS follow_up_terminal_guard ON follow_ups;
                DROP FUNCTION IF EXISTS protect_terminal_follow_up();
                """);
            migrationBuilder.DropTable(
                name: "communication_activities");

            migrationBuilder.DropTable(
                name: "follow_ups");
        }
    }
}
