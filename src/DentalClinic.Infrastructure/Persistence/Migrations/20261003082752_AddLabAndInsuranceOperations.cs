using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF generates index column arrays in migrations.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLabAndInsuranceOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "clinic_business_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Details = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_business_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "insurance_batches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_batches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "insurance_claims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientInsuranceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PatientShare = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ApprovalNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ExternalClaimNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_claims", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "insurance_payers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    ContractNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_payers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "insurance_settlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimId = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insurance_settlements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lab_cases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    StatementId = table.Column<Guid>(type: "uuid", nullable: true),
                    WorkType = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Teeth = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Material = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Shade = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Instructions = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: true),
                    DueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RemakeCount = table.Column<int>(type: "integer", nullable: false),
                    LastUpdateNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lab_cases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lab_settlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StatementId = table.Column<Guid>(type: "uuid", nullable: false),
                    CaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lab_settlements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lab_statements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lab_statements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "lab_vendors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lab_vendors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "patient_insurances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayerId = table.Column<Guid>(type: "uuid", nullable: false),
                    MemberNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ReferralNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_insurances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_clinic_business_events_TenantId_EntityType_EntityId_Occurre~",
                table: "clinic_business_events",
                columns: new[] { "TenantId", "EntityType", "EntityId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_batches_TenantId_PayerId_CreatedAt",
                table: "insurance_batches",
                columns: new[] { "TenantId", "PayerId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_claims_TenantId_BatchId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "BatchId" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_claims_TenantId_PatientId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_claims_TenantId_TreatmentId_PatientInsuranceId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "TreatmentId", "PatientInsuranceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_payers_TenantId_Name",
                table: "insurance_payers",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_settlements_TenantId_BatchId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "BatchId" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_settlements_TenantId_ClaimId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "ClaimId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_cases_TenantId_PatientId",
                table: "lab_cases",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_cases_TenantId_StatementId",
                table: "lab_cases",
                columns: new[] { "TenantId", "StatementId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_cases_TenantId_VendorId_DueAt",
                table: "lab_cases",
                columns: new[] { "TenantId", "VendorId", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_settlements_TenantId_CaseId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "CaseId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_settlements_TenantId_StatementId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "StatementId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_statements_TenantId_VendorId_CreatedAt",
                table: "lab_statements",
                columns: new[] { "TenantId", "VendorId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_vendors_TenantId_Name",
                table: "lab_vendors",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_patient_insurances_TenantId_PatientId",
                table: "patient_insurances",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.Sql("""
                INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "Permission")
                SELECT gen_random_uuid(), r."TenantId", r."Id", p.permission
                FROM tenant_roles r
                CROSS JOIN (VALUES
                    ('CLINICADMIN', 'Lab.View'), ('CLINICADMIN', 'Lab.Manage'), ('CLINICADMIN', 'Lab.Settle'),
                    ('CLINICADMIN', 'Insurance.View'), ('CLINICADMIN', 'Insurance.Manage'), ('CLINICADMIN', 'Insurance.Settle'),
                    ('DOCTOR', 'Lab.View'), ('DOCTOR', 'Lab.Manage'), ('DOCTOR', 'Insurance.View'),
                    ('RECEPTIONIST', 'Lab.View'), ('RECEPTIONIST', 'Lab.Manage'),
                    ('RECEPTIONIST', 'Insurance.View'), ('RECEPTIONIST', 'Insurance.Manage')
                ) AS p(role_name, permission)
                WHERE r."NormalizedName" = p.role_name
                ON CONFLICT DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM role_permissions WHERE \"Permission\" IN ('Lab.View', 'Lab.Manage', 'Lab.Settle', 'Insurance.View', 'Insurance.Manage', 'Insurance.Settle');");
            migrationBuilder.DropTable(
                name: "clinic_business_events");

            migrationBuilder.DropTable(
                name: "insurance_batches");

            migrationBuilder.DropTable(
                name: "insurance_claims");

            migrationBuilder.DropTable(
                name: "insurance_payers");

            migrationBuilder.DropTable(
                name: "insurance_settlements");

            migrationBuilder.DropTable(
                name: "lab_cases");

            migrationBuilder.DropTable(
                name: "lab_settlements");

            migrationBuilder.DropTable(
                name: "lab_statements");

            migrationBuilder.DropTable(
                name: "lab_vendors");

            migrationBuilder.DropTable(
                name: "patient_insurances");
        }
    }
}
