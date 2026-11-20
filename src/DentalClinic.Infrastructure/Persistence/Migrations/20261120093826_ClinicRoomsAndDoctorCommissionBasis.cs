using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClinicRoomsAndDoctorCommissionBasis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_doctor_compensation_costs_TenantId_TreatmentId",
                table: "doctor_compensation_costs");

            migrationBuilder.AddColumn<Guid>(
                name: "PaidCommissionRuleId",
                table: "revenues",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CommissionBasis",
                table: "doctor_compensations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentId",
                table: "doctor_compensation_costs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RoomId",
                table: "appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "clinic_rooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_rooms", x => x.Id);
                    table.UniqueConstraint("AK_clinic_rooms_TenantId_Id", x => new { x.TenantId, x.Id });
                });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_PaymentId",
                table: "doctor_compensation_costs",
                columns: ["TenantId", "PaymentId"],
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_TreatmentId",
                table: "doctor_compensation_costs",
                columns: ["TenantId", "TreatmentId"],
                unique: true,
                filter: "\"PaymentId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_RoomId",
                table: "appointments",
                columns: ["TenantId", "RoomId"]);

            migrationBuilder.CreateIndex(
                name: "IX_clinic_rooms_TenantId_Name",
                table: "clinic_rooms",
                columns: ["TenantId", "Name"],
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_appointments_clinic_rooms_TenantId_RoomId",
                table: "appointments",
                columns: ["TenantId", "RoomId"],
                principalTable: "clinic_rooms",
                principalColumns: ["TenantId", "Id"],
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_doctor_compensation_costs_payments_TenantId_PaymentId",
                table: "doctor_compensation_costs",
                columns: ["TenantId", "PaymentId"],
                principalTable: "payments",
                principalColumns: ["TenantId", "Id"],
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql("""
                ALTER TABLE appointments ADD CONSTRAINT "EX_appointments_room_overlap"
                    EXCLUDE USING gist ("TenantId" WITH =, "RoomId" WITH =,
                    tstzrange("StartAt", "EndAt", '[)') WITH &&)
                    WHERE ("RoomId" IS NOT NULL AND "Status" NOT IN (6, 7));

                GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_rooms TO meddentist_runtime;
                CREATE POLICY row_read ON public.clinic_rooms FOR SELECT TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_insert ON public.clinic_rooms FOR INSERT TO meddentist_runtime
                    WITH CHECK (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_update ON public.clinic_rooms FOR UPDATE TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId")) WITH CHECK (clinic_security.tenant_access("TenantId"));
                CREATE POLICY row_delete ON public.clinic_rooms FOR DELETE TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId"));
                ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public.clinic_rooms FORCE ROW LEVEL SECURITY;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE appointments DROP CONSTRAINT "EX_appointments_room_overlap";""");
            migrationBuilder.DropForeignKey(
                name: "FK_appointments_clinic_rooms_TenantId_RoomId",
                table: "appointments");

            migrationBuilder.DropForeignKey(
                name: "FK_doctor_compensation_costs_payments_TenantId_PaymentId",
                table: "doctor_compensation_costs");

            migrationBuilder.DropTable(
                name: "clinic_rooms");

            migrationBuilder.DropIndex(
                name: "IX_doctor_compensation_costs_TenantId_PaymentId",
                table: "doctor_compensation_costs");

            migrationBuilder.DropIndex(
                name: "IX_doctor_compensation_costs_TenantId_TreatmentId",
                table: "doctor_compensation_costs");

            migrationBuilder.DropIndex(
                name: "IX_appointments_TenantId_RoomId",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "PaidCommissionRuleId",
                table: "revenues");

            migrationBuilder.DropColumn(
                name: "CommissionBasis",
                table: "doctor_compensations");

            migrationBuilder.DropColumn(
                name: "PaymentId",
                table: "doctor_compensation_costs");

            migrationBuilder.DropColumn(
                name: "RoomId",
                table: "appointments");

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_TreatmentId",
                table: "doctor_compensation_costs",
                columns: ["TenantId", "TreatmentId"],
                unique: true);
        }
    }
}
