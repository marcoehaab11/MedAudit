using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261018100000_OrthodonticWholeMouthFinding")]
public class OrthodonticWholeMouthFinding : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 16");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 15");
    }
}
