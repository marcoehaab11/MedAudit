using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformHealthMonitoring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "platform_health_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProbeKey = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    Details = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_health_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_health_probes",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    ConsecutiveFailures = table.Column<int>(type: "integer", nullable: false),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastSuccessAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_health_probes", x => x.Key);
                });

            migrationBuilder.CreateIndex(
                name: "IX_platform_health_events_OccurredAt",
                table: "platform_health_events",
                column: "OccurredAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "platform_health_events");

            migrationBuilder.DropTable(
                name: "platform_health_probes");
        }
    }
}
