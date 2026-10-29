using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // Generated migration arrays.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClinicalTreatmentPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "clinical_photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinical_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clinical_photos_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_clinical_photos_TenantId_TreatmentId",
                table: "clinical_photos",
                columns: new[] { "TenantId", "TreatmentId" });
            migrationBuilder.Sql("""
                GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_photos TO meddentist_runtime;
                CREATE POLICY row_read ON public.clinical_photos FOR SELECT TO meddentist_runtime USING (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_insert ON public.clinical_photos FOR INSERT TO meddentist_runtime WITH CHECK (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_update ON public.clinical_photos FOR UPDATE TO meddentist_runtime USING (clinic_security.tenant_access("TenantId")) WITH CHECK (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_delete ON public.clinical_photos FOR DELETE TO meddentist_runtime USING (clinic_security.tenant_access("TenantId"));
                ALTER TABLE public.clinical_photos ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public.clinical_photos FORCE ROW LEVEL SECURITY;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "clinical_photos");
        }
    }
}
