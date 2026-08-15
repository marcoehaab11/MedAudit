using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase9Prescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "medication_catalog_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GenericName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Strength = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Form = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_medication_catalog_items", x => x.Id);
                    table.UniqueConstraint("AK_medication_catalog_items_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_medication_catalog_items_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "prescription_number_sequences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LastValue = table.Column<long>(type: "bigint", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_number_sequences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_prescription_number_sequences_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "prescriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExaminationId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PrescriptionNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    IssuedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DocumentReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescriptions", x => x.Id);
                    table.UniqueConstraint("AK_prescriptions_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_prescriptions_appointments_TenantId_AppointmentId",
                        columns: x => new { x.TenantId, x.AppointmentId },
                        principalTable: "appointments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_clinic_users_TenantId_IssuedBy",
                        columns: x => new { x.TenantId, x.IssuedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_examinations_TenantId_ExaminationId",
                        columns: x => new { x.TenantId, x.ExaminationId },
                        principalTable: "examinations",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescriptions_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "prescription_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicationId = table.Column<Guid>(type: "uuid", nullable: true),
                    MedicationNameSnapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    GenericNameSnapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StrengthSnapshot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FormSnapshot = table.Column<int>(type: "integer", nullable: true),
                    Dose = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Frequency = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Duration = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Route = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prescription_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_prescription_items_medication_catalog_items_TenantId_Medica~",
                        columns: x => new { x.TenantId, x.MedicationId },
                        principalTable: "medication_catalog_items",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_prescription_items_prescriptions_TenantId_PrescriptionId",
                        columns: x => new { x.TenantId, x.PrescriptionId },
                        principalTable: "prescriptions",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_medication_catalog_items_TenantId_GenericName",
                table: "medication_catalog_items",
                columns: new[] { "TenantId", "GenericName" });

            migrationBuilder.CreateIndex(
                name: "IX_medication_catalog_items_TenantId_IsActive_Name",
                table: "medication_catalog_items",
                columns: new[] { "TenantId", "IsActive", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_prescription_items_TenantId_MedicationId",
                table: "prescription_items",
                columns: new[] { "TenantId", "MedicationId" });

            migrationBuilder.CreateIndex(
                name: "IX_prescription_items_TenantId_PrescriptionId_SortOrder",
                table: "prescription_items",
                columns: new[] { "TenantId", "PrescriptionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_prescription_number_sequences_TenantId",
                table: "prescription_number_sequences",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_DocumentReference",
                table: "prescriptions",
                column: "DocumentReference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_AppointmentId",
                table: "prescriptions",
                columns: new[] { "TenantId", "AppointmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_CreatedBy",
                table: "prescriptions",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_DoctorProfileId_CreatedAt",
                table: "prescriptions",
                columns: new[] { "TenantId", "DoctorProfileId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_ExaminationId",
                table: "prescriptions",
                columns: new[] { "TenantId", "ExaminationId" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_IssuedBy",
                table: "prescriptions",
                columns: new[] { "TenantId", "IssuedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_PatientId_CreatedAt",
                table: "prescriptions",
                columns: new[] { "TenantId", "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_PrescriptionNumber",
                table: "prescriptions",
                columns: new[] { "TenantId", "PrescriptionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_Status_CreatedAt",
                table: "prescriptions",
                columns: new[] { "TenantId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_prescriptions_TenantId_TreatmentId",
                table: "prescriptions",
                columns: new[] { "TenantId", "TreatmentId" });

            migrationBuilder.Sql(
                """
                ALTER TABLE medication_catalog_items ADD CONSTRAINT "CK_medication_form" CHECK ("Form" IS NULL OR "Form" BETWEEN 1 AND 8);
                ALTER TABLE prescriptions ADD CONSTRAINT "CK_prescription_status" CHECK ("Status" BETWEEN 1 AND 3);
                ALTER TABLE prescriptions ADD CONSTRAINT "CK_prescription_issue_metadata" CHECK (("Status" = 1 AND "IssuedAt" IS NULL AND "IssuedBy" IS NULL AND "DocumentReference" IS NULL) OR ("Status" IN (2,3)));
                ALTER TABLE prescription_items ADD CONSTRAINT "CK_prescription_item_form" CHECK ("FormSnapshot" IS NULL OR "FormSnapshot" BETWEEN 1 AND 8);
                ALTER TABLE prescription_items ADD CONSTRAINT "CK_prescription_item_quantity" CHECK ("Quantity" IS NULL OR "Quantity" BETWEEN 1 AND 10000);
                ALTER TABLE prescription_items ADD CONSTRAINT "CK_prescription_item_sort" CHECK ("SortOrder" BETWEEN 1 AND 100);

                CREATE FUNCTION prevent_locked_prescription_item_mutation() RETURNS trigger AS $$
                DECLARE prescription_status integer;
                BEGIN
                    SELECT "Status" INTO prescription_status FROM prescriptions WHERE "TenantId" = COALESCE(NEW."TenantId", OLD."TenantId") AND "Id" = COALESCE(NEW."PrescriptionId", OLD."PrescriptionId");
                    IF prescription_status <> 1 THEN RAISE EXCEPTION 'Issued or cancelled prescription items are immutable' USING ERRCODE = '23514'; END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER prescription_items_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON prescription_items FOR EACH ROW EXECUTE FUNCTION prevent_locked_prescription_item_mutation();

                CREATE FUNCTION prevent_locked_prescription_mutation() RETURNS trigger AS $$
                BEGIN
                    IF TG_OP = 'DELETE' AND OLD."Status" IN (2,3) THEN RAISE EXCEPTION 'Issued or cancelled prescriptions cannot be deleted' USING ERRCODE = '23514'; END IF;
                    IF OLD."Status" = 3 THEN RAISE EXCEPTION 'Cancelled prescriptions are immutable' USING ERRCODE = '23514'; END IF;
                    IF OLD."Status" = 2 AND NOT (NEW."Status" = 3 AND
                        (OLD."PatientId",OLD."DoctorProfileId",OLD."AppointmentId",OLD."ExaminationId",OLD."TreatmentId",OLD."PrescriptionNumber",OLD."Notes",OLD."CreatedAt",OLD."IssuedAt",OLD."CreatedBy",OLD."IssuedBy",OLD."DocumentReference")
                        IS NOT DISTINCT FROM
                        (NEW."PatientId",NEW."DoctorProfileId",NEW."AppointmentId",NEW."ExaminationId",NEW."TreatmentId",NEW."PrescriptionNumber",NEW."Notes",NEW."CreatedAt",NEW."IssuedAt",NEW."CreatedBy",NEW."IssuedBy",NEW."DocumentReference"))
                    THEN RAISE EXCEPTION 'Issued prescriptions are immutable' USING ERRCODE = '23514'; END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER prescriptions_locked_guard BEFORE UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION prevent_locked_prescription_mutation();

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId" FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Prescriptions.Issue'), ('Prescriptions.Cancel')) AS permission(name)
                WHERE role."NormalizedName" IN ('CLINICADMIN','DOCTOR') ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                DELETE FROM role_permissions AS role_permission USING tenant_roles AS role
                WHERE role_permission."RoleId" = role."Id" AND role."NormalizedName" = 'DOCTOR' AND role_permission."Permission" = 'Prescriptions.Send';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions WHERE "Permission" IN ('Prescriptions.Issue','Prescriptions.Cancel');
                DROP TRIGGER IF EXISTS prescriptions_locked_guard ON prescriptions;
                DROP TRIGGER IF EXISTS prescription_items_locked_guard ON prescription_items;
                DROP FUNCTION IF EXISTS prevent_locked_prescription_mutation();
                DROP FUNCTION IF EXISTS prevent_locked_prescription_item_mutation();
                """);
            migrationBuilder.DropTable(
                name: "prescription_items");

            migrationBuilder.DropTable(
                name: "prescription_number_sequences");

            migrationBuilder.DropTable(
                name: "medication_catalog_items");

            migrationBuilder.DropTable(
                name: "prescriptions");
        }
    }
}
