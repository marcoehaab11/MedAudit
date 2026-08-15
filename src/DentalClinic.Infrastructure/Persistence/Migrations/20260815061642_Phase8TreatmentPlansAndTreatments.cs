using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase8TreatmentPlansAndTreatments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "treatment_catalog_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DefaultPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_treatment_catalog_items", x => x.Id);
                    table.UniqueConstraint("AK_treatment_catalog_items_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_treatment_catalog_items_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "treatment_plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ProposedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RejectedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_treatment_plans", x => x.Id);
                    table.UniqueConstraint("AK_treatment_plans_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_treatment_plans_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatment_plans_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "treatment_plan_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentCatalogItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentType = table.Column<int>(type: "integer", nullable: false),
                    TreatmentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_treatment_plan_items", x => x.Id);
                    table.UniqueConstraint("AK_treatment_plan_items_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_treatment_plan_items_treatment_catalog_items_TenantId_Treat~",
                        columns: x => new { x.TenantId, x.TreatmentCatalogItemId },
                        principalTable: "treatment_catalog_items",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatment_plan_items_treatment_plans_TenantId_TreatmentPlan~",
                        columns: x => new { x.TenantId, x.TreatmentPlanId },
                        principalTable: "treatment_plans",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "treatments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentPlanItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentCatalogItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceDentalProcedureId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    TreatmentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_treatments", x => x.Id);
                    table.UniqueConstraint("AK_treatments_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_treatments_appointments_TenantId_AppointmentId",
                        columns: x => new { x.TenantId, x.AppointmentId },
                        principalTable: "appointments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_dental_procedures_TenantId_SourceDentalProcedure~",
                        columns: x => new { x.TenantId, x.SourceDentalProcedureId },
                        principalTable: "dental_procedures",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_treatment_catalog_items_TenantId_TreatmentCatalo~",
                        columns: x => new { x.TenantId, x.TreatmentCatalogItemId },
                        principalTable: "treatment_catalog_items",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_treatment_plan_items_TenantId_TreatmentPlanItemId",
                        columns: x => new { x.TenantId, x.TreatmentPlanItemId },
                        principalTable: "treatment_plan_items",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_treatments_treatment_plans_TenantId_TreatmentPlanId",
                        columns: x => new { x.TenantId, x.TreatmentPlanId },
                        principalTable: "treatment_plans",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "treatment_teeth",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_treatment_teeth", x => x.Id);
                    table.ForeignKey(
                        name: "FK_treatment_teeth_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_catalog_items_TenantId_Code",
                table: "treatment_catalog_items",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_treatment_catalog_items_TenantId_IsActive_Name",
                table: "treatment_catalog_items",
                columns: new[] { "TenantId", "IsActive", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_plan_items_TenantId_TreatmentCatalogItemId",
                table: "treatment_plan_items",
                columns: new[] { "TenantId", "TreatmentCatalogItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_plan_items_TenantId_TreatmentPlanId",
                table: "treatment_plan_items",
                columns: new[] { "TenantId", "TreatmentPlanId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_plans_TenantId_DoctorProfileId_Status_CreatedAt",
                table: "treatment_plans",
                columns: new[] { "TenantId", "DoctorProfileId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_plans_TenantId_PatientId_CreatedAt",
                table: "treatment_plans",
                columns: new[] { "TenantId", "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_teeth_TenantId_ToothNumber",
                table: "treatment_teeth",
                columns: new[] { "TenantId", "ToothNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_treatment_teeth_TenantId_TreatmentId_ToothNumber",
                table: "treatment_teeth",
                columns: new[] { "TenantId", "TreatmentId", "ToothNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_AppointmentId",
                table: "treatments",
                columns: new[] { "TenantId", "AppointmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_DoctorProfileId_Status_CreatedAt",
                table: "treatments",
                columns: new[] { "TenantId", "DoctorProfileId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_PatientId_CreatedAt",
                table: "treatments",
                columns: new[] { "TenantId", "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_SourceDentalProcedureId",
                table: "treatments",
                columns: new[] { "TenantId", "SourceDentalProcedureId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_TreatmentCatalogItemId",
                table: "treatments",
                columns: new[] { "TenantId", "TreatmentCatalogItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_TreatmentPlanId",
                table: "treatments",
                columns: new[] { "TenantId", "TreatmentPlanId" });

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_TreatmentPlanItemId",
                table: "treatments",
                columns: new[] { "TenantId", "TreatmentPlanItemId" });

            migrationBuilder.Sql(
                """
                ALTER TABLE treatment_catalog_items ADD CONSTRAINT "CK_treatment_catalog_type" CHECK ("Type" BETWEEN 1 AND 6);
                ALTER TABLE treatment_catalog_items ADD CONSTRAINT "CK_treatment_catalog_price" CHECK ("DefaultPrice" >= 0);
                ALTER TABLE treatment_plans ADD CONSTRAINT "CK_treatment_plan_status" CHECK ("Status" BETWEEN 1 AND 7);
                ALTER TABLE treatment_plans ADD CONSTRAINT "CK_treatment_plan_totals" CHECK ("Subtotal" >= 0 AND "DiscountAmount" >= 0 AND "DiscountAmount" <= "Subtotal" AND "Total" = "Subtotal" - "DiscountAmount");
                ALTER TABLE treatment_plan_items ADD CONSTRAINT "CK_treatment_plan_item_type" CHECK ("TreatmentType" BETWEEN 1 AND 6);
                ALTER TABLE treatment_plan_items ADD CONSTRAINT "CK_treatment_plan_item_quantity" CHECK ("Quantity" BETWEEN 1 AND 100);
                ALTER TABLE treatment_plan_items ADD CONSTRAINT "CK_treatment_plan_item_totals" CHECK ("UnitPrice" >= 0 AND "DiscountAmount" >= 0 AND "DiscountAmount" <= "UnitPrice" * "Quantity" AND "Total" = "UnitPrice" * "Quantity" - "DiscountAmount");
                ALTER TABLE treatments ADD CONSTRAINT "CK_treatment_type" CHECK ("Type" BETWEEN 1 AND 6);
                ALTER TABLE treatments ADD CONSTRAINT "CK_treatment_status" CHECK ("Status" BETWEEN 1 AND 5);
                ALTER TABLE treatments ADD CONSTRAINT "CK_treatment_price" CHECK ("Price" >= 0);
                ALTER TABLE treatment_teeth ADD CONSTRAINT "CK_treatment_tooth_fdi" CHECK ("ToothNumber" IN (11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48));

                CREATE FUNCTION prevent_locked_plan_item_mutation() RETURNS trigger AS $$
                DECLARE plan_status integer;
                BEGIN
                    SELECT "Status" INTO plan_status FROM treatment_plans WHERE "TenantId" = COALESCE(NEW."TenantId", OLD."TenantId") AND "Id" = COALESCE(NEW."TreatmentPlanId", OLD."TreatmentPlanId");
                    IF plan_status <> 1 THEN RAISE EXCEPTION 'Only draft treatment plans can change items' USING ERRCODE = '23514'; END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER treatment_plan_items_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON treatment_plan_items FOR EACH ROW EXECUTE FUNCTION prevent_locked_plan_item_mutation();

                CREATE FUNCTION prevent_locked_plan_content_mutation() RETURNS trigger AS $$
                BEGIN
                    IF OLD."Status" <> 1 AND (OLD."PatientId", OLD."DoctorProfileId", OLD."Title", OLD."Notes", OLD."Subtotal", OLD."DiscountAmount", OLD."Total") IS DISTINCT FROM (NEW."PatientId", NEW."DoctorProfileId", NEW."Title", NEW."Notes", NEW."Subtotal", NEW."DiscountAmount", NEW."Total") THEN
                        RAISE EXCEPTION 'Accepted or terminal treatment plan content is immutable' USING ERRCODE = '23514';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER treatment_plans_locked_guard BEFORE UPDATE ON treatment_plans FOR EACH ROW EXECUTE FUNCTION prevent_locked_plan_content_mutation();

                CREATE FUNCTION prevent_completed_treatment_mutation() RETURNS trigger AS $$
                BEGIN
                    IF OLD."Status" = 4 THEN RAISE EXCEPTION 'Completed treatments are immutable' USING ERRCODE = '23514'; END IF;
                    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER treatments_completed_guard BEFORE UPDATE OR DELETE ON treatments FOR EACH ROW EXECUTE FUNCTION prevent_completed_treatment_mutation();

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId" FROM tenant_roles AS role
                CROSS JOIN (VALUES ('TreatmentPlans.View'), ('TreatmentPlans.Create'), ('TreatmentPlans.Edit'), ('TreatmentPlans.Propose'), ('TreatmentPlans.Accept'), ('TreatmentPlans.Reject'), ('TreatmentPlans.Cancel'), ('Treatments.Start'), ('Treatments.Cancel'), ('TreatmentCatalog.View')) AS permission(name)
                WHERE role."NormalizedName" IN ('CLINICADMIN', 'DOCTOR') ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", 'TreatmentCatalog.Manage', role."TenantId" FROM tenant_roles AS role
                WHERE role."NormalizedName" = 'CLINICADMIN' ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions WHERE "Permission" IN ('TreatmentPlans.View','TreatmentPlans.Create','TreatmentPlans.Edit','TreatmentPlans.Propose','TreatmentPlans.Accept','TreatmentPlans.Reject','TreatmentPlans.Cancel','Treatments.Start','Treatments.Cancel','TreatmentCatalog.View','TreatmentCatalog.Manage');
                DROP TRIGGER IF EXISTS treatments_completed_guard ON treatments;
                DROP TRIGGER IF EXISTS treatment_plans_locked_guard ON treatment_plans;
                DROP TRIGGER IF EXISTS treatment_plan_items_locked_guard ON treatment_plan_items;
                DROP FUNCTION IF EXISTS prevent_completed_treatment_mutation();
                DROP FUNCTION IF EXISTS prevent_locked_plan_content_mutation();
                DROP FUNCTION IF EXISTS prevent_locked_plan_item_mutation();
                """);
            migrationBuilder.DropTable(
                name: "treatment_teeth");

            migrationBuilder.DropTable(
                name: "treatments");

            migrationBuilder.DropTable(
                name: "treatment_plan_items");

            migrationBuilder.DropTable(
                name: "treatment_catalog_items");

            migrationBuilder.DropTable(
                name: "treatment_plans");
        }
    }
}
