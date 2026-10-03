using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF generates composite key arrays in migrations.

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkClinicBusinessAccounting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseId",
                table: "lab_settlements",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentId",
                table: "insurance_settlements",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddUniqueConstraint(
                name: "AK_patient_insurances_TenantId_Id",
                table: "patient_insurances",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_lab_vendors_TenantId_Id",
                table: "lab_vendors",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_lab_statements_TenantId_Id",
                table: "lab_statements",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_lab_cases_TenantId_Id",
                table: "lab_cases",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_insurance_payers_TenantId_Id",
                table: "insurance_payers",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_insurance_claims_TenantId_Id",
                table: "insurance_claims",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_insurance_batches_TenantId_Id",
                table: "insurance_batches",
                columns: new[] { "TenantId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_patient_insurances_TenantId_PayerId",
                table: "patient_insurances",
                columns: new[] { "TenantId", "PayerId" });

            migrationBuilder.CreateIndex(
                name: "IX_lab_settlements_TenantId_ExpenseId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "ExpenseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lab_cases_TenantId_TreatmentId",
                table: "lab_cases",
                columns: new[] { "TenantId", "TreatmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_insurance_settlements_TenantId_PaymentId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "PaymentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_claims_TenantId_PatientInsuranceId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "PatientInsuranceId" });

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_batches_insurance_payers_TenantId_PayerId",
                table: "insurance_batches",
                columns: new[] { "TenantId", "PayerId" },
                principalTable: "insurance_payers",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_claims_insurance_batches_TenantId_BatchId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "BatchId" },
                principalTable: "insurance_batches",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_claims_patient_insurances_TenantId_PatientInsuran~",
                table: "insurance_claims",
                columns: new[] { "TenantId", "PatientInsuranceId" },
                principalTable: "patient_insurances",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_claims_patients_TenantId_PatientId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "PatientId" },
                principalTable: "patients",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_claims_treatments_TenantId_TreatmentId",
                table: "insurance_claims",
                columns: new[] { "TenantId", "TreatmentId" },
                principalTable: "treatments",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_settlements_insurance_batches_TenantId_BatchId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "BatchId" },
                principalTable: "insurance_batches",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_settlements_insurance_claims_TenantId_ClaimId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "ClaimId" },
                principalTable: "insurance_claims",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_insurance_settlements_payments_TenantId_PaymentId",
                table: "insurance_settlements",
                columns: new[] { "TenantId", "PaymentId" },
                principalTable: "payments",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_cases_lab_statements_TenantId_StatementId",
                table: "lab_cases",
                columns: new[] { "TenantId", "StatementId" },
                principalTable: "lab_statements",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_cases_lab_vendors_TenantId_VendorId",
                table: "lab_cases",
                columns: new[] { "TenantId", "VendorId" },
                principalTable: "lab_vendors",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_cases_patients_TenantId_PatientId",
                table: "lab_cases",
                columns: new[] { "TenantId", "PatientId" },
                principalTable: "patients",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_cases_treatments_TenantId_TreatmentId",
                table: "lab_cases",
                columns: new[] { "TenantId", "TreatmentId" },
                principalTable: "treatments",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_settlements_expenses_TenantId_ExpenseId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "ExpenseId" },
                principalTable: "expenses",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_settlements_lab_cases_TenantId_CaseId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "CaseId" },
                principalTable: "lab_cases",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_settlements_lab_statements_TenantId_StatementId",
                table: "lab_settlements",
                columns: new[] { "TenantId", "StatementId" },
                principalTable: "lab_statements",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_lab_statements_lab_vendors_TenantId_VendorId",
                table: "lab_statements",
                columns: new[] { "TenantId", "VendorId" },
                principalTable: "lab_vendors",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_patient_insurances_insurance_payers_TenantId_PayerId",
                table: "patient_insurances",
                columns: new[] { "TenantId", "PayerId" },
                principalTable: "insurance_payers",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_patient_insurances_patients_TenantId_PatientId",
                table: "patient_insurances",
                columns: new[] { "TenantId", "PatientId" },
                principalTable: "patients",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_insurance_batches_insurance_payers_TenantId_PayerId",
                table: "insurance_batches");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_claims_insurance_batches_TenantId_BatchId",
                table: "insurance_claims");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_claims_patient_insurances_TenantId_PatientInsuran~",
                table: "insurance_claims");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_claims_patients_TenantId_PatientId",
                table: "insurance_claims");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_claims_treatments_TenantId_TreatmentId",
                table: "insurance_claims");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_settlements_insurance_batches_TenantId_BatchId",
                table: "insurance_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_settlements_insurance_claims_TenantId_ClaimId",
                table: "insurance_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_insurance_settlements_payments_TenantId_PaymentId",
                table: "insurance_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_cases_lab_statements_TenantId_StatementId",
                table: "lab_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_cases_lab_vendors_TenantId_VendorId",
                table: "lab_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_cases_patients_TenantId_PatientId",
                table: "lab_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_cases_treatments_TenantId_TreatmentId",
                table: "lab_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_settlements_expenses_TenantId_ExpenseId",
                table: "lab_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_settlements_lab_cases_TenantId_CaseId",
                table: "lab_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_settlements_lab_statements_TenantId_StatementId",
                table: "lab_settlements");

            migrationBuilder.DropForeignKey(
                name: "FK_lab_statements_lab_vendors_TenantId_VendorId",
                table: "lab_statements");

            migrationBuilder.DropForeignKey(
                name: "FK_patient_insurances_insurance_payers_TenantId_PayerId",
                table: "patient_insurances");

            migrationBuilder.DropForeignKey(
                name: "FK_patient_insurances_patients_TenantId_PatientId",
                table: "patient_insurances");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_patient_insurances_TenantId_Id",
                table: "patient_insurances");

            migrationBuilder.DropIndex(
                name: "IX_patient_insurances_TenantId_PayerId",
                table: "patient_insurances");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_lab_vendors_TenantId_Id",
                table: "lab_vendors");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_lab_statements_TenantId_Id",
                table: "lab_statements");

            migrationBuilder.DropIndex(
                name: "IX_lab_settlements_TenantId_ExpenseId",
                table: "lab_settlements");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_lab_cases_TenantId_Id",
                table: "lab_cases");

            migrationBuilder.DropIndex(
                name: "IX_lab_cases_TenantId_TreatmentId",
                table: "lab_cases");

            migrationBuilder.DropIndex(
                name: "IX_insurance_settlements_TenantId_PaymentId",
                table: "insurance_settlements");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_insurance_payers_TenantId_Id",
                table: "insurance_payers");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_insurance_claims_TenantId_Id",
                table: "insurance_claims");

            migrationBuilder.DropIndex(
                name: "IX_insurance_claims_TenantId_PatientInsuranceId",
                table: "insurance_claims");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_insurance_batches_TenantId_Id",
                table: "insurance_batches");

            migrationBuilder.DropColumn(
                name: "ExpenseId",
                table: "lab_settlements");

            migrationBuilder.DropColumn(
                name: "PaymentId",
                table: "insurance_settlements");
        }
    }
}
