using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace DentalClinic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261021160000_EnforceRowLevelSecurity")]
public sealed class EnforceRowLevelSecurity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        using var stream = typeof(EnforceRowLevelSecurity).Assembly.GetManifestResourceStream(
            "DentalClinic.Infrastructure.Persistence.Migrations.RowLevelSecurity.sql")
            ?? throw new InvalidOperationException("The reviewed row-security SQL is missing.");
        using var reader = new StreamReader(stream);
        migrationBuilder.Sql(reader.ReadToEnd());
    }

    protected override void Down(MigrationBuilder migrationBuilder) => throw new NotSupportedException(
        "Do not silently remove database isolation. Restore a reviewed backup or prepare an explicit security rollback.");
}
