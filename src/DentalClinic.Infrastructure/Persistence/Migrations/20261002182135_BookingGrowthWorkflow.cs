using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BookingGrowthWorkflow : Migration
    {
        private static readonly string[] VisitTenantCreatedAtColumns = ["TenantId", "CreatedAt"];
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "LicenseNumber",
                table: "doctor_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<Guid>(
                name: "AssignedToUserId",
                table: "booking_inquiries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "FollowUpAt",
                table: "booking_inquiries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "booking_inquiries",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "direct");

            migrationBuilder.AddColumn<string>(
                name: "StaffNotes",
                table: "booking_inquiries",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "booking_inquiries",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "New");

            migrationBuilder.Sql("UPDATE booking_inquiries SET \"Status\" = 'Contacted' WHERE \"ContactedAt\" IS NOT NULL;");

            migrationBuilder.AddColumn<Guid>(
                name: "PublicBookingAssignedToUserId",
                table: "appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PublicBookingFollowUpAt",
                table: "appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicBookingSource",
                table: "appointments",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicBookingStaffNotes",
                table: "appointments",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicManagementTokenHash",
                table: "appointments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "booking_page_visits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_booking_page_visits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_booking_page_visits_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_appointments_PublicManagementTokenHash",
                table: "appointments",
                column: "PublicManagementTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_booking_page_visits_TenantId_CreatedAt",
                table: "booking_page_visits",
                columns: VisitTenantCreatedAtColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "booking_page_visits");

            migrationBuilder.DropIndex(
                name: "IX_appointments_PublicManagementTokenHash",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                table: "booking_inquiries");

            migrationBuilder.DropColumn(
                name: "FollowUpAt",
                table: "booking_inquiries");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "booking_inquiries");

            migrationBuilder.DropColumn(
                name: "StaffNotes",
                table: "booking_inquiries");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "booking_inquiries");

            migrationBuilder.DropColumn(
                name: "PublicBookingAssignedToUserId",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "PublicBookingFollowUpAt",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "PublicBookingSource",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "PublicBookingStaffNotes",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "PublicManagementTokenHash",
                table: "appointments");

            migrationBuilder.AlterColumn<string>(
                name: "LicenseNumber",
                table: "doctor_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

        }
    }
}
