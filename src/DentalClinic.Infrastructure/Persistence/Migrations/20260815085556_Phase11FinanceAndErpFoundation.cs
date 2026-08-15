using System;
using Microsoft.EntityFrameworkCore.Migrations;

#pragma warning disable CA1861

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase11FinanceAndErpFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "doctor_compensation_costs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    CompensationRuleSnapshot = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctor_compensation_costs", x => x.Id);
                    table.UniqueConstraint("AK_doctor_compensation_costs_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_doctor_compensation_costs_doctor_profiles_TenantId_DoctorPr~",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_doctor_compensation_costs_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "financial_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_financial_categories", x => x.Id);
                    table.UniqueConstraint("AK_financial_categories_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_financial_categories_financial_categories_TenantId_ParentId",
                        columns: x => new { x.TenantId, x.ParentId },
                        principalTable: "financial_categories",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "financial_transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SourceType = table.Column<int>(type: "integer", nullable: false),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_financial_transactions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "expenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    VendorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Reference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ExpenseDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expenses", x => x.Id);
                    table.UniqueConstraint("AK_expenses_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_expenses_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_expenses_financial_categories_TenantId_CategoryId",
                        columns: x => new { x.TenantId, x.CategoryId },
                        principalTable: "financial_categories",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "revenues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    DoctorProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_revenues", x => x.Id);
                    table.UniqueConstraint("AK_revenues_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_revenues_doctor_profiles_TenantId_DoctorProfileId",
                        columns: x => new { x.TenantId, x.DoctorProfileId },
                        principalTable: "doctor_profiles",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_revenues_financial_categories_TenantId_CategoryId",
                        columns: x => new { x.TenantId, x.CategoryId },
                        principalTable: "financial_categories",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_revenues_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_revenues_treatment_plans_TenantId_TreatmentPlanId",
                        columns: x => new { x.TenantId, x.TreatmentPlanId },
                        principalTable: "treatment_plans",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_revenues_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    Reference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.Id);
                    table.UniqueConstraint("AK_payments_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_payments_clinic_users_TenantId_CreatedBy",
                        columns: x => new { x.TenantId, x.CreatedBy },
                        principalTable: "clinic_users",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payments_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payments_revenues_TenantId_RevenueId",
                        columns: x => new { x.TenantId, x.RevenueId },
                        principalTable: "revenues",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payments_treatments_TenantId_TreatmentId",
                        columns: x => new { x.TenantId, x.TreatmentId },
                        principalTable: "treatments",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_DoctorProfileId",
                table: "doctor_compensation_costs",
                columns: new[] { "TenantId", "DoctorProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_OccurredAt",
                table: "doctor_compensation_costs",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_doctor_compensation_costs_TenantId_TreatmentId",
                table: "doctor_compensation_costs",
                columns: new[] { "TenantId", "TreatmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TenantId_CategoryId",
                table: "expenses",
                columns: new[] { "TenantId", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TenantId_CreatedBy",
                table: "expenses",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TenantId_ExpenseDate",
                table: "expenses",
                columns: new[] { "TenantId", "ExpenseDate" });

            migrationBuilder.CreateIndex(
                name: "IX_financial_categories_TenantId_Code",
                table: "financial_categories",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_categories_TenantId_ParentId",
                table: "financial_categories",
                columns: new[] { "TenantId", "ParentId" });

            migrationBuilder.CreateIndex(
                name: "IX_financial_categories_TenantId_Type_IsActive",
                table: "financial_categories",
                columns: new[] { "TenantId", "Type", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_financial_transactions_TenantId_OccurredAt",
                table: "financial_transactions",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_financial_transactions_TenantId_SourceType_SourceId",
                table: "financial_transactions",
                columns: new[] { "TenantId", "SourceType", "SourceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payments_TenantId_CreatedBy",
                table: "payments",
                columns: new[] { "TenantId", "CreatedBy" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_TenantId_PaidAt",
                table: "payments",
                columns: new[] { "TenantId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_TenantId_PatientId",
                table: "payments",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_TenantId_RevenueId",
                table: "payments",
                columns: new[] { "TenantId", "RevenueId" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_TenantId_TreatmentId",
                table: "payments",
                columns: new[] { "TenantId", "TreatmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_CategoryId",
                table: "revenues",
                columns: new[] { "TenantId", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_DoctorProfileId",
                table: "revenues",
                columns: new[] { "TenantId", "DoctorProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_OccurredAt",
                table: "revenues",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_PatientId",
                table: "revenues",
                columns: new[] { "TenantId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_TreatmentId",
                table: "revenues",
                columns: new[] { "TenantId", "TreatmentId" },
                unique: true,
                filter: "\"TreatmentId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_revenues_TenantId_TreatmentPlanId",
                table: "revenues",
                columns: new[] { "TenantId", "TreatmentPlanId" });

            migrationBuilder.Sql("""
                ALTER TABLE financial_categories ADD CONSTRAINT ck_financial_categories_type CHECK ("Type" IN (1, 2));
                ALTER TABLE revenues ADD CONSTRAINT ck_revenues_amount CHECK ("Amount" >= 0);
                ALTER TABLE payments ADD CONSTRAINT ck_payments_amount CHECK ("Amount" > 0);
                ALTER TABLE payments ADD CONSTRAINT ck_payments_method CHECK ("PaymentMethod" IN (1, 2, 3, 4));
                ALTER TABLE expenses ADD CONSTRAINT ck_expenses_amount CHECK ("Amount" > 0);
                ALTER TABLE doctor_compensation_costs ADD CONSTRAINT ck_doctor_cost_amount CHECK ("Amount" > 0);
                ALTER TABLE financial_transactions ADD CONSTRAINT ck_financial_transactions_amount CHECK ("Amount" >= 0);
                ALTER TABLE financial_transactions ADD CONSTRAINT ck_financial_transactions_type CHECK ("Type" IN (1, 2, 3, 4, 5, 6));

                CREATE OR REPLACE FUNCTION protect_posted_financial_record() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'Posted financial records are immutable' USING ERRCODE = '55000';
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER protect_revenues BEFORE UPDATE OR DELETE ON revenues FOR EACH ROW EXECUTE FUNCTION protect_posted_financial_record();
                CREATE TRIGGER protect_payments BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION protect_posted_financial_record();
                CREATE TRIGGER protect_expenses BEFORE UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION protect_posted_financial_record();
                CREATE TRIGGER protect_doctor_costs BEFORE UPDATE OR DELETE ON doctor_compensation_costs FOR EACH ROW EXECUTE FUNCTION protect_posted_financial_record();
                CREATE TRIGGER protect_financial_transactions BEFORE UPDATE OR DELETE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION protect_posted_financial_record();

                CREATE OR REPLACE FUNCTION validate_payment_balance() RETURNS trigger AS $$
                DECLARE revenue_amount numeric(18,2); revenue_currency varchar(3); revenue_patient uuid; revenue_treatment uuid; already_paid numeric(18,2);
                BEGIN
                    SELECT "Amount", "Currency", "PatientId", "TreatmentId" INTO revenue_amount, revenue_currency, revenue_patient, revenue_treatment
                    FROM revenues WHERE "TenantId" = NEW."TenantId" AND "Id" = NEW."RevenueId" FOR UPDATE;
                    IF NOT FOUND THEN RAISE EXCEPTION 'Revenue is not available for this tenant' USING ERRCODE = '23503'; END IF;
                    SELECT COALESCE(SUM("Amount"), 0) INTO already_paid FROM payments WHERE "TenantId" = NEW."TenantId" AND "RevenueId" = NEW."RevenueId";
                    IF NEW."Currency" <> revenue_currency OR NEW."PatientId" IS DISTINCT FROM revenue_patient OR NEW."TreatmentId" IS DISTINCT FROM revenue_treatment THEN
                        RAISE EXCEPTION 'Payment references or currency do not match revenue' USING ERRCODE = '23514';
                    END IF;
                    IF already_paid + NEW."Amount" > revenue_amount THEN RAISE EXCEPTION 'Payment exceeds outstanding revenue' USING ERRCODE = '23514'; END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                CREATE TRIGGER validate_payment_before_insert BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION validate_payment_balance();

                INSERT INTO financial_categories ("Id", "Name", "Code", "Type", "ParentId", "IsActive", "CreatedAt", "UpdatedAt", "Version", "TenantId")
                SELECT gen_random_uuid(), v.name, v.code, v.type, NULL, TRUE, NOW(), NOW(), gen_random_uuid(), t."Id"
                FROM tenants t CROSS JOIN (VALUES
                    ('Treatment Revenue','TREATMENT_REVENUE',1), ('Consultation Revenue','CONSULTATION_REVENUE',1), ('Other Revenue','OTHER_REVENUE',1),
                    ('Rent','RENT',2), ('Electricity','ELECTRICITY',2), ('Gas','GAS',2), ('Water','WATER',2), ('Internet','INTERNET',2),
                    ('Materials','MATERIALS',2), ('Maintenance','MAINTENANCE',2), ('Marketing','MARKETING',2), ('Administrative','ADMINISTRATIVE',2),
                    ('Salaries','SALARIES',2), ('Doctor Compensation','DOCTOR_COMPENSATION',2), ('Other','OTHER_EXPENSE',2)
                ) AS v(name, code, type) ON CONFLICT ("TenantId", "Code") DO NOTHING;

                INSERT INTO role_permissions ("Id", "Permission", "TenantId", "RoleId")
                SELECT gen_random_uuid(), p.permission, r."TenantId", r."Id" FROM tenant_roles r
                CROSS JOIN (VALUES ('Finance.View'),('Finance.Dashboard'),('Finance.Categories.View'),('Finance.Categories.Manage'),('Finance.Revenue.View'),
                    ('Finance.Payments.View'),('Finance.Payments.Create'),('Finance.Expenses.View'),('Finance.Expenses.Create'),('Finance.Expenses.Edit'),
                    ('Finance.DoctorCompensation.View'),('Finance.DoctorCompensation.Manage')) p(permission)
                WHERE r."NormalizedName" = 'CLINICADMIN' ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                INSERT INTO role_permissions ("Id", "Permission", "TenantId", "RoleId")
                SELECT gen_random_uuid(), p.permission, r."TenantId", r."Id" FROM tenant_roles r
                CROSS JOIN (VALUES ('Finance.View'),('Finance.Revenue.View'),('Finance.Payments.View'),('Finance.Payments.Create')) p(permission)
                WHERE r."NormalizedName" = 'RECEPTIONIST' ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM role_permissions WHERE "Permission" IN ('Finance.View','Finance.Dashboard','Finance.Categories.View','Finance.Categories.Manage','Finance.Revenue.View','Finance.Payments.View','Finance.Payments.Create','Finance.Expenses.View','Finance.Expenses.Create','Finance.Expenses.Edit','Finance.DoctorCompensation.View','Finance.DoctorCompensation.Manage');
                DROP FUNCTION IF EXISTS validate_payment_balance() CASCADE;
                DROP FUNCTION IF EXISTS protect_posted_financial_record() CASCADE;
                """);
            migrationBuilder.DropTable(
                name: "doctor_compensation_costs");

            migrationBuilder.DropTable(
                name: "expenses");

            migrationBuilder.DropTable(
                name: "financial_transactions");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "revenues");

            migrationBuilder.DropTable(
                name: "financial_categories");
        }
    }
}
