using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkClinicBranches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentClinicId",
                table: "tenants",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenants_ParentClinicId",
                table: "tenants",
                column: "ParentClinicId");

            migrationBuilder.AddForeignKey(
                name: "FK_tenants_tenants_ParentClinicId",
                table: "tenants",
                column: "ParentClinicId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tenants_tenants_ParentClinicId",
                table: "tenants");

            migrationBuilder.DropIndex(
                name: "IX_tenants_ParentClinicId",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "ParentClinicId",
                table: "tenants");
        }
    }
}
