using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace DentalClinic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261018130000_PostCanalAndVisitPriceApproval")]
public class PostCanalAndVisitPriceApproval : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "PostCanal", table: "endodontic_records", type: "text", nullable: true);
        migrationBuilder.AddColumn<bool>(name: "PriceConfirmed", table: "treatments", type: "boolean", nullable: false, defaultValue: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PostCanal", table: "endodontic_records");
        migrationBuilder.DropColumn(name: "PriceConfirmed", table: "treatments");
    }
}
