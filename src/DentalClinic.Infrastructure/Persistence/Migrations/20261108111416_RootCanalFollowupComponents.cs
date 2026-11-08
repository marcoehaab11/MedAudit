using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // Generated migration arrays.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RootCanalFollowupComponents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FlowComponentKey",
                table: "treatments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsClinicalFlowContainer",
                table: "treatments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentTreatmentId",
                table: "treatments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_treatments_TenantId_ParentTreatmentId_FlowComponentKey",
                table: "treatments",
                columns: new[] { "TenantId", "ParentTreatmentId", "FlowComponentKey" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_treatments_treatments_TenantId_ParentTreatmentId",
                table: "treatments",
                columns: new[] { "TenantId", "ParentTreatmentId" },
                principalTable: "treatments",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_treatments_treatments_TenantId_ParentTreatmentId",
                table: "treatments");

            migrationBuilder.DropIndex(
                name: "IX_treatments_TenantId_ParentTreatmentId_FlowComponentKey",
                table: "treatments");

            migrationBuilder.DropColumn(
                name: "FlowComponentKey",
                table: "treatments");

            migrationBuilder.DropColumn(
                name: "IsClinicalFlowContainer",
                table: "treatments");

            migrationBuilder.DropColumn(
                name: "ParentTreatmentId",
                table: "treatments");
        }
    }
}
