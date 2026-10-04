using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF-generated migration column arrays.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrackPatientBranchTransfers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "patient_branch_transfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceTenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourcePatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetPatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransferredBy = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicalSnapshotJson = table.Column<string>(type: "jsonb", nullable: false),
                    TransferredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_branch_transfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_branch_transfers_patients_TenantId_TargetPatientId",
                        columns: x => new { x.TenantId, x.TargetPatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_patient_branch_transfers_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_patient_branch_transfers_SourceTenantId_SourcePatientId",
                table: "patient_branch_transfers",
                columns: new[] { "SourceTenantId", "SourcePatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_patient_branch_transfers_TenantId_TargetPatientId",
                table: "patient_branch_transfers",
                columns: new[] { "TenantId", "TargetPatientId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "patient_branch_transfers");
        }
    }
}
