using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RootCanalVisitProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Stage",
                table: "endodontic_records",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TreatmentId",
                table: "endodontic_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "LengthMm",
                table: "endodontic_canals",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldPrecision: 5,
                oldScale: 2);

            migrationBuilder.AddColumn<string>(
                name: "FinalFileSize",
                table: "endodontic_canals",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Never invent a clinical measurement when returning to the old required column.
            migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM endodontic_canals WHERE \"LengthMm\" IS NULL) THEN RAISE EXCEPTION 'Cannot roll back while unmeasured canals exist.'; END IF; END $$;");
            migrationBuilder.DropColumn(
                name: "Stage",
                table: "endodontic_records");

            migrationBuilder.DropColumn(
                name: "TreatmentId",
                table: "endodontic_records");

            migrationBuilder.DropColumn(
                name: "FinalFileSize",
                table: "endodontic_canals");

            migrationBuilder.AlterColumn<decimal>(
                name: "LengthMm",
                table: "endodontic_canals",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldPrecision: 5,
                oldScale: 2,
                oldNullable: true);
        }
    }
}
