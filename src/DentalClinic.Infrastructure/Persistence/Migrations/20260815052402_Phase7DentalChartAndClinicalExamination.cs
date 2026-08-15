using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase7DentalChartAndClinicalExamination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "examinations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_examinations", x => x.Id);
                    table.UniqueConstraint("AK_examinations_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_examinations_appointments_TenantId_AppointmentId",
                        columns: x => new { x.TenantId, x.AppointmentId },
                        principalTable: "appointments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_examinations_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_examinations_clinic_users_TenantId_DoctorUserId",
                        columns: x => new { x.TenantId, x.DoctorUserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_examinations_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dental_findings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExaminationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    FindingType = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dental_findings", x => x.Id);
                    table.UniqueConstraint("AK_dental_findings_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_dental_findings_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dental_findings_examinations_TenantId_ExaminationId",
                        columns: x => new { x.TenantId, x.ExaminationId },
                        principalTable: "examinations",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_dental_findings_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dental_procedures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExaminationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    ProcedureType = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dental_procedures", x => x.Id);
                    table.UniqueConstraint("AK_dental_procedures_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_dental_procedures_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dental_procedures_examinations_TenantId_ExaminationId",
                        columns: x => new { x.TenantId, x.ExaminationId },
                        principalTable: "examinations",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_dental_procedures_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "endodontic_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExaminationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_endodontic_records", x => x.Id);
                    table.UniqueConstraint("AK_endodontic_records_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_endodontic_records_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_endodontic_records_examinations_TenantId_ExaminationId",
                        columns: x => new { x.TenantId, x.ExaminationId },
                        principalTable: "examinations",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_endodontic_records_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dental_finding_surfaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FindingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Surface = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dental_finding_surfaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_dental_finding_surfaces_dental_findings_TenantId_FindingId",
                        columns: x => new { x.TenantId, x.FindingId },
                        principalTable: "dental_findings",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "dental_procedure_surfaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcedureId = table.Column<Guid>(type: "uuid", nullable: false),
                    Surface = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dental_procedure_surfaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_dental_procedure_surfaces_dental_procedures_TenantId_Proced~",
                        columns: x => new { x.TenantId, x.ProcedureId },
                        principalTable: "dental_procedures",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "endodontic_canals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EndodonticRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LengthMm = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_endodontic_canals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_endodontic_canals_endodontic_records_TenantId_EndodonticRec~",
                        columns: x => new { x.TenantId, x.EndodonticRecordId },
                        principalTable: "endodontic_records",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_dental_finding_surfaces_TenantId_FindingId_Surface",
                table: "dental_finding_surfaces",
                columns: new[] { "TenantId", "FindingId", "Surface" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_dental_findings_TenantId_CreatedBy",
                table: "dental_findings",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_dental_findings_TenantId_ExaminationId",
                table: "dental_findings",
                columns: new[] { "TenantId", "ExaminationId" });

            migrationBuilder.CreateIndex(
                name: "IX_dental_findings_TenantId_PatientId_ToothNumber_CreatedAt",
                table: "dental_findings",
                columns: new[] { "TenantId", "PatientId", "ToothNumber", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_dental_procedure_surfaces_TenantId_ProcedureId_Surface",
                table: "dental_procedure_surfaces",
                columns: new[] { "TenantId", "ProcedureId", "Surface" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_dental_procedures_TenantId_CreatedBy",
                table: "dental_procedures",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_dental_procedures_TenantId_ExaminationId",
                table: "dental_procedures",
                columns: new[] { "TenantId", "ExaminationId" });

            migrationBuilder.CreateIndex(
                name: "IX_dental_procedures_TenantId_PatientId_ToothNumber_CreatedAt",
                table: "dental_procedures",
                columns: new[] { "TenantId", "PatientId", "ToothNumber", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_endodontic_canals_TenantId_EndodonticRecordId_Name",
                table: "endodontic_canals",
                columns: new[] { "TenantId", "EndodonticRecordId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_endodontic_records_TenantId_CreatedBy",
                table: "endodontic_records",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_endodontic_records_TenantId_ExaminationId",
                table: "endodontic_records",
                columns: new[] { "TenantId", "ExaminationId" });

            migrationBuilder.CreateIndex(
                name: "IX_endodontic_records_TenantId_PatientId_ToothNumber_CreatedAt",
                table: "endodontic_records",
                columns: new[] { "TenantId", "PatientId", "ToothNumber", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_examinations_TenantId_AppointmentId",
                table: "examinations",
                columns: new[] { "TenantId", "AppointmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_examinations_TenantId_CreatedBy",
                table: "examinations",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_examinations_TenantId_DoctorUserId",
                table: "examinations",
                columns: new[] { "TenantId", "DoctorUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_examinations_TenantId_PatientId_CreatedAt",
                table: "examinations",
                columns: new[] { "TenantId", "PatientId", "CreatedAt" });

            migrationBuilder.Sql(
                """
                ALTER TABLE examinations ADD CONSTRAINT "CK_examinations_status" CHECK ("Status" IN (1, 2));
                ALTER TABLE dental_findings ADD CONSTRAINT "CK_dental_findings_tooth"
                    CHECK ("ToothNumber" IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
                        31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48));
                ALTER TABLE dental_findings ADD CONSTRAINT "CK_dental_findings_type" CHECK ("FindingType" BETWEEN 1 AND 7);
                ALTER TABLE dental_procedures ADD CONSTRAINT "CK_dental_procedures_tooth"
                    CHECK ("ToothNumber" IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
                        31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48));
                ALTER TABLE dental_procedures ADD CONSTRAINT "CK_dental_procedures_type" CHECK ("ProcedureType" BETWEEN 1 AND 6);
                ALTER TABLE endodontic_records ADD CONSTRAINT "CK_endodontic_records_tooth"
                    CHECK ("ToothNumber" IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
                        31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48));
                ALTER TABLE dental_finding_surfaces ADD CONSTRAINT "CK_dental_finding_surfaces_value" CHECK ("Surface" BETWEEN 1 AND 10);
                ALTER TABLE dental_procedure_surfaces ADD CONSTRAINT "CK_dental_procedure_surfaces_value" CHECK ("Surface" BETWEEN 1 AND 10);
                ALTER TABLE endodontic_canals ADD CONSTRAINT "CK_endodontic_canals_length" CHECK ("LengthMm" > 0 AND "LengthMm" <= 50);
                ALTER TABLE endodontic_canals ADD CONSTRAINT "CK_endodontic_canals_name" CHECK (length(btrim("Name")) > 0);

                CREATE FUNCTION prevent_completed_examination_mutation() RETURNS trigger AS $$
                BEGIN
                    IF OLD."Status" = 2 THEN
                        RAISE EXCEPTION 'Completed examinations are immutable' USING ERRCODE = '23514';
                    END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER examinations_completed_guard BEFORE UPDATE OR DELETE ON examinations
                    FOR EACH ROW EXECUTE FUNCTION prevent_completed_examination_mutation();

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('Examination.View'), ('Examination.Create'), ('Examination.Edit'), ('Examination.Complete'),
                    ('DentalHistory.View'), ('DentalHistory.Edit')) AS permission(name)
                WHERE role."NormalizedName" IN ('CLINICADMIN', 'DOCTOR')
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions
                WHERE "Permission" IN ('Examination.View', 'Examination.Create', 'Examination.Edit',
                    'Examination.Complete', 'DentalHistory.View', 'DentalHistory.Edit');
                DROP TRIGGER IF EXISTS examinations_completed_guard ON examinations;
                DROP FUNCTION IF EXISTS prevent_completed_examination_mutation();
                """);
            migrationBuilder.DropTable(
                name: "dental_finding_surfaces");

            migrationBuilder.DropTable(
                name: "dental_procedure_surfaces");

            migrationBuilder.DropTable(
                name: "endodontic_canals");

            migrationBuilder.DropTable(
                name: "dental_findings");

            migrationBuilder.DropTable(
                name: "dental_procedures");

            migrationBuilder.DropTable(
                name: "endodontic_records");

            migrationBuilder.DropTable(
                name: "examinations");
        }
    }
}
