using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // Generated migration arrays.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImplantWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "implant_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    WorkflowJson = table.Column<string>(type: "jsonb", nullable: false),
                    AppointmentLinksJson = table.Column<string>(type: "jsonb", nullable: false),
                    CompletedStep = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_implant_records", x => x.Id);
                    table.UniqueConstraint("AK_implant_records_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_implant_records_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_implant_records_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_implant_records_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "implant_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ImplantRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    Section = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_implant_attachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_implant_attachments_implant_records_TenantId_ImplantRecordId",
                        columns: x => new { x.TenantId, x.ImplantRecordId },
                        principalTable: "implant_records",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_implant_attachments_TenantId_ImplantRecordId",
                table: "implant_attachments",
                columns: new[] { "TenantId", "ImplantRecordId" });

            migrationBuilder.CreateIndex(
                name: "IX_implant_records_TenantId_DoctorProfileId",
                table: "implant_records",
                columns: new[] { "TenantId", "DoctorProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_implant_records_TenantId_PatientId_ToothNumber",
                table: "implant_records",
                columns: new[] { "TenantId", "PatientId", "ToothNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_implant_records_TenantId_TreatmentId",
                table: "implant_records",
                columns: new[] { "TenantId", "TreatmentId" },
                unique: true,
                filter: "\"TreatmentId\" IS NOT NULL");
            migrationBuilder.Sql("""
                DO $implant_security$
                DECLARE target text;
                BEGIN
                  FOREACH target IN ARRAY ARRAY['implant_records', 'implant_attachments'] LOOP
                    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO meddentist_runtime', target);
                    EXECUTE format('CREATE POLICY row_read ON public.%I FOR SELECT TO meddentist_runtime USING (clinic_security.tenant_access("TenantId"))', target);
                    EXECUTE format('CREATE POLICY row_insert ON public.%I FOR INSERT TO meddentist_runtime WITH CHECK (clinic_security.tenant_access("TenantId"))', target);
                    EXECUTE format('CREATE POLICY row_update ON public.%I FOR UPDATE TO meddentist_runtime USING (clinic_security.tenant_access("TenantId")) WITH CHECK (clinic_security.tenant_access("TenantId"))', target);
                    EXECUTE format('CREATE POLICY row_delete ON public.%I FOR DELETE TO meddentist_runtime USING (clinic_security.tenant_access("TenantId"))', target);
                    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
                    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target);
                  END LOOP;
                END $implant_security$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "implant_attachments");

            migrationBuilder.DropTable(
                name: "implant_records");
        }
    }
}
