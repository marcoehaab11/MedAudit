using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCariesClassification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CariesClass",
                table: "dental_findings",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CariesClass",
                table: "dental_findings");
        }
    }
}
