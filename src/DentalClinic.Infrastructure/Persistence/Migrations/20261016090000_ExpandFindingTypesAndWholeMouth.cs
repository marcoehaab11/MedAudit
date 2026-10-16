using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations;

public partial class ExpandFindingTypesAndWholeMouth : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 13");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 10");
    }
}
