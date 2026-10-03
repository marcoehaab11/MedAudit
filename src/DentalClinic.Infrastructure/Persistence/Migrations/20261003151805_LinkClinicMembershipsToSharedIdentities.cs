using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF-generated migration column arrays.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkClinicMembershipsToSharedIdentities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_admin_invitations_AspNetUsers_UserId",
                table: "admin_invitations");

            migrationBuilder.DropForeignKey(
                name: "FK_clinic_users_AspNetUsers_Id",
                table: "clinic_users");

            migrationBuilder.DropIndex(
                name: "IX_admin_invitations_UserId",
                table: "admin_invitations");

            migrationBuilder.AddColumn<Guid>(
                name: "IdentityUserId",
                table: "clinic_users",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("UPDATE clinic_users SET \"IdentityUserId\" = \"Id\";");

            migrationBuilder.AlterColumn<Guid>(
                name: "IdentityUserId",
                table: "clinic_users",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_clinic_users_IdentityUserId",
                table: "clinic_users",
                column: "IdentityUserId");

            migrationBuilder.CreateIndex(
                name: "IX_clinic_users_TenantId_IdentityUserId",
                table: "clinic_users",
                columns: new[] { "TenantId", "IdentityUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_admin_invitations_TenantId_UserId",
                table: "admin_invitations",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.AddForeignKey(
                name: "FK_admin_invitations_clinic_users_TenantId_UserId",
                table: "admin_invitations",
                columns: new[] { "TenantId", "UserId" },
                principalTable: "clinic_users",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_clinic_users_AspNetUsers_IdentityUserId",
                table: "clinic_users",
                column: "IdentityUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM "AspNetUsers" WHERE "NormalizedEmail" IS NOT NULL
                               GROUP BY "NormalizedEmail" HAVING COUNT(*) > 1) THEN
                        RAISE EXCEPTION 'Duplicate account emails must be resolved before enabling shared clinic identities.';
                    END IF;
                END $$;
                CREATE UNIQUE INDEX "UX_AspNetUsers_NormalizedEmail_SharedClinics"
                    ON "AspNetUsers" ("NormalizedEmail") WHERE "NormalizedEmail" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM clinic_users WHERE "IdentityUserId" <> "Id") THEN
                        RAISE EXCEPTION 'Shared clinic memberships must be removed before reverting this migration.';
                    END IF;
                END $$;
                """);
            migrationBuilder.Sql("DROP INDEX \"UX_AspNetUsers_NormalizedEmail_SharedClinics\";");
            migrationBuilder.DropForeignKey(
                name: "FK_admin_invitations_clinic_users_TenantId_UserId",
                table: "admin_invitations");

            migrationBuilder.DropForeignKey(
                name: "FK_clinic_users_AspNetUsers_IdentityUserId",
                table: "clinic_users");

            migrationBuilder.DropIndex(
                name: "IX_clinic_users_IdentityUserId",
                table: "clinic_users");

            migrationBuilder.DropIndex(
                name: "IX_clinic_users_TenantId_IdentityUserId",
                table: "clinic_users");

            migrationBuilder.DropIndex(
                name: "IX_admin_invitations_TenantId_UserId",
                table: "admin_invitations");

            migrationBuilder.DropColumn(
                name: "IdentityUserId",
                table: "clinic_users");

            migrationBuilder.CreateIndex(
                name: "IX_admin_invitations_UserId",
                table: "admin_invitations",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_admin_invitations_AspNetUsers_UserId",
                table: "admin_invitations",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_clinic_users_AspNetUsers_Id",
                table: "clinic_users",
                column: "Id",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
