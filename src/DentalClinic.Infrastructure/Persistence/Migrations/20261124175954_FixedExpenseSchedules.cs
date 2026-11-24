using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixedExpenseSchedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "fixed_expense_schedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Beneficiary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MonthlyAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DueDay = table.Column<int>(type: "integer", nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fixed_expense_schedules", x => x.Id);
                    table.UniqueConstraint("AK_fixed_expense_schedules_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_fixed_expense_schedules_financial_categories_TenantId_Categ~",
                        columns: x => new { x.TenantId, x.CategoryId },
                        principalTable: "financial_categories",
                        principalColumns: ["TenantId", "Id"],
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "fixed_expenses_due",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Month = table.Column<DateOnly>(type: "date", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    ExpenseId = table.Column<Guid>(type: "uuid", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fixed_expenses_due", x => x.Id);
                    table.ForeignKey(
                        name: "FK_fixed_expenses_due_expenses_TenantId_ExpenseId",
                        columns: x => new { x.TenantId, x.ExpenseId },
                        principalTable: "expenses",
                        principalColumns: ["TenantId", "Id"],
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_fixed_expenses_due_fixed_expense_schedules_TenantId_Schedul~",
                        columns: x => new { x.TenantId, x.ScheduleId },
                        principalTable: "fixed_expense_schedules",
                        principalColumns: ["TenantId", "Id"],
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_fixed_expense_schedules_TenantId_CategoryId",
                table: "fixed_expense_schedules",
                columns: ["TenantId", "CategoryId"]);

            migrationBuilder.CreateIndex(
                name: "IX_fixed_expense_schedules_TenantId_Name",
                table: "fixed_expense_schedules",
                columns: ["TenantId", "Name"],
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fixed_expenses_due_TenantId_ExpenseId",
                table: "fixed_expenses_due",
                columns: ["TenantId", "ExpenseId"],
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fixed_expenses_due_TenantId_ScheduleId_Month",
                table: "fixed_expenses_due",
                columns: ["TenantId", "ScheduleId", "Month"],
                unique: true);

            migrationBuilder.Sql("""
                ALTER TABLE public.fixed_expense_schedules ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public.fixed_expense_schedules FORCE ROW LEVEL SECURITY;
                GRANT SELECT, INSERT ON public.fixed_expense_schedules TO meddentist_runtime;
                CREATE POLICY row_read ON public.fixed_expense_schedules FOR SELECT TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId") OR pg_has_role(session_user, 'meddentist_worker', 'member'));
                CREATE POLICY row_insert ON public.fixed_expense_schedules FOR INSERT TO meddentist_runtime
                    WITH CHECK (clinic_security.tenant_access("TenantId"));

                ALTER TABLE public.fixed_expenses_due ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public.fixed_expenses_due FORCE ROW LEVEL SECURITY;
                GRANT SELECT, INSERT, UPDATE ON public.fixed_expenses_due TO meddentist_runtime;
                CREATE POLICY row_read ON public.fixed_expenses_due FOR SELECT TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId") OR pg_has_role(session_user, 'meddentist_worker', 'member'));
                CREATE POLICY row_insert ON public.fixed_expenses_due FOR INSERT TO meddentist_runtime
                    WITH CHECK (clinic_security.tenant_access("TenantId") OR pg_has_role(session_user, 'meddentist_worker', 'member'));
                CREATE POLICY row_update ON public.fixed_expenses_due FOR UPDATE TO meddentist_runtime
                    USING (clinic_security.tenant_access("TenantId"))
                    WITH CHECK (clinic_security.tenant_access("TenantId"));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "fixed_expenses_due");

            migrationBuilder.DropTable(
                name: "fixed_expense_schedules");
        }
    }
}
