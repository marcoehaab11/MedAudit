using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase13PublicBooking : Migration
    {
        private static readonly string[] TenantBookingReferenceColumns = ["TenantId", "BookingReference"];
        private static readonly string[] TenantIdempotencyKeyColumns = ["TenantId", "IdempotencyKey"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPublicBookingEnabled",
                table: "treatment_catalog_items",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationMinutes",
                table: "treatment_catalog_items",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<bool>(
                name: "PublicBookingEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PublicBookingHorizonDays",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<bool>(
                name: "PublicPriceVisibility",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPublicBookingEnabled",
                table: "doctor_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "BookingReference",
                table: "appointments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TreatmentCatalogItemId",
                table: "appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "public_booking_idempotency_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RequestHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BookingReference = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_public_booking_idempotency_records", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_TenantId_BookingReference",
                table: "appointments",
                columns: TenantBookingReferenceColumns);

            migrationBuilder.CreateIndex(
                name: "IX_public_booking_idempotency_records_TenantId_IdempotencyKey",
                table: "public_booking_idempotency_records",
                columns: TenantIdempotencyKeyColumns,
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "public_booking_idempotency_records");

            migrationBuilder.DropIndex(
                name: "IX_appointments_TenantId_BookingReference",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "IsPublicBookingEnabled",
                table: "treatment_catalog_items");

            migrationBuilder.DropColumn(
                name: "DurationMinutes",
                table: "treatment_catalog_items");

            migrationBuilder.DropColumn(
                name: "PublicBookingEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PublicBookingHorizonDays",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PublicPriceVisibility",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "IsPublicBookingEnabled",
                table: "doctor_profiles");

            migrationBuilder.DropColumn(
                name: "BookingReference",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "TreatmentCatalogItemId",
                table: "appointments");
        }
    }
}
