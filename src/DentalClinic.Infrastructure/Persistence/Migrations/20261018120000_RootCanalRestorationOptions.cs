using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace DentalClinic.Infrastructure.Persistence.Migrations;
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261018120000_RootCanalRestorationOptions")]
public class RootCanalRestorationOptions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "RestorationType", table: "endodontic_records", type: "text", nullable: true);
        migrationBuilder.AddColumn<string>(name: "PostType", table: "endodontic_records", type: "text", nullable: true);
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 17");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "RestorationType", table: "endodontic_records");
        migrationBuilder.DropColumn(name: "PostType", table: "endodontic_records");
        migrationBuilder.DropCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings");
        migrationBuilder.AddCheckConstraint(name: "CK_dental_findings_type", table: "dental_findings", sql: "\"FindingType\" BETWEEN 1 AND 16");
    }
}
