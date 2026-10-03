using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF generates composite key arrays in migrations.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPermissionProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_permission_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permissions = table.Column<string[]>(type: "text[]", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_permission_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_permission_profiles_clinic_users_TenantId_UserId",
                        columns: x => new { x.TenantId, x.UserId },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_permission_profiles_TenantId_UserId",
                table: "user_permission_profiles",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.Sql("""
                INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "Permission")
                SELECT gen_random_uuid(), r."TenantId", r."Id", 'Backup.Create'
                FROM tenant_roles r WHERE r."NormalizedName" = 'CLINICADMIN'
                ON CONFLICT DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM role_permissions WHERE \"Permission\" = 'Backup.Create';");
            migrationBuilder.DropTable(
                name: "user_permission_profiles");
        }
    }
}
