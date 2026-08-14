using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase3IdentityUsersRolesPermissions : Migration
    {
        private static readonly string[] UserTenantStatusColumns = ["TenantId", "Status"];
        private static readonly string[] PermissionUniqueColumns = ["TenantId", "RoleId", "Permission"];
        private static readonly string[] RoleNameUniqueColumns = ["TenantId", "NormalizedName"];
        private static readonly string[] UserRoleUniqueColumns = ["TenantId", "UserId", "RoleId"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "clinic_users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clinic_users_AspNetUsers_Id",
                        column: x => x.Id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_clinic_users_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "tenant_roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsSystemRole = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_roles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tenant_roles_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permission = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_role_permissions_tenant_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "tenant_roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_role_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_role_assignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_role_assignments_clinic_users_UserId",
                        column: x => x.UserId,
                        principalTable: "clinic_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_role_assignments_tenant_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "tenant_roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_clinic_users_TenantId_Status",
                table: "clinic_users",
                columns: UserTenantStatusColumns);

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_RoleId",
                table: "role_permissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_TenantId_RoleId_Permission",
                table: "role_permissions",
                columns: PermissionUniqueColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_roles_TenantId_NormalizedName",
                table: "tenant_roles",
                columns: RoleNameUniqueColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_role_assignments_RoleId",
                table: "user_role_assignments",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_user_role_assignments_TenantId_UserId_RoleId",
                table: "user_role_assignments",
                columns: UserRoleUniqueColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_role_assignments_UserId",
                table: "user_role_assignments",
                column: "UserId");

            migrationBuilder.Sql(
                """
                INSERT INTO tenant_roles ("Id", "Name", "NormalizedName", "Description", "IsSystemRole", "CreatedAt", "UpdatedAt", "TenantId")
                SELECT gen_random_uuid(), roles.name, upper(roles.name), 'Built-in ' || roles.name || ' role.', true,
                       tenants."CreatedAt", tenants."CreatedAt", tenants."Id"
                FROM tenants
                CROSS JOIN (VALUES ('ClinicAdmin'), ('Doctor'), ('Receptionist')) AS roles(name);

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('Patients.View'), ('Patients.Create'), ('Patients.Edit'), ('Patients.Archive'),
                    ('Appointments.View'), ('Appointments.Create'), ('Appointments.Edit'), ('Appointments.Cancel'), ('Appointments.ManageSchedule'),
                    ('Dental.View'), ('Dental.Create'), ('Dental.Edit'),
                    ('Treatments.View'), ('Treatments.Create'), ('Treatments.Edit'), ('Treatments.Approve'), ('Treatments.Complete'),
                    ('Prescriptions.View'), ('Prescriptions.Create'), ('Prescriptions.Edit'), ('Prescriptions.Print'), ('Prescriptions.Download'), ('Prescriptions.Send'),
                    ('Finance.View'), ('Finance.CreatePayment'), ('Finance.CreateExpense'), ('Finance.ManageSalaries'),
                    ('Reports.View'), ('Reports.Clinical'), ('Reports.Financial'), ('Reports.CRM'), ('Reports.Export'),
                    ('Users.View'), ('Users.Create'), ('Users.Edit'), ('Users.Activate'), ('Users.Deactivate'), ('Users.ManageRoles'),
                    ('Settings.View'), ('Settings.Edit')
                ) AS permission(name)
                WHERE role."NormalizedName" = 'CLINICADMIN';

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('Patients.View'), ('Patients.Create'), ('Patients.Edit'),
                    ('Appointments.View'), ('Appointments.Create'), ('Appointments.Edit'),
                    ('Dental.View'), ('Dental.Create'), ('Dental.Edit'),
                    ('Treatments.View'), ('Treatments.Create'), ('Treatments.Edit'), ('Treatments.Approve'), ('Treatments.Complete'),
                    ('Prescriptions.View'), ('Prescriptions.Create'), ('Prescriptions.Edit'), ('Prescriptions.Print'), ('Prescriptions.Download'), ('Prescriptions.Send')
                ) AS permission(name)
                WHERE role."NormalizedName" = 'DOCTOR';

                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES
                    ('Patients.View'), ('Patients.Create'), ('Patients.Edit'),
                    ('Appointments.View'), ('Appointments.Create'), ('Appointments.Edit'), ('Appointments.Cancel'), ('Appointments.ManageSchedule')
                ) AS permission(name)
                WHERE role."NormalizedName" = 'RECEPTIONIST';

                INSERT INTO clinic_users ("Id", "DisplayName", "Phone", "Status", "CreatedAt", "UpdatedAt", "TenantId")
                SELECT identity."Id", 'Clinic Administrator', NULL,
                       CASE WHEN invitation."Status" = 2 THEN 2 ELSE 1 END,
                       tenant."CreatedAt", tenant."CreatedAt", identity."TenantId"
                FROM "AspNetUsers" AS identity
                JOIN tenants AS tenant ON tenant."Id" = identity."TenantId"
                LEFT JOIN admin_invitations AS invitation ON invitation."UserId" = identity."Id"
                WHERE identity."TenantId" IS NOT NULL
                ON CONFLICT ("Id") DO NOTHING;

                INSERT INTO user_role_assignments ("Id", "UserId", "RoleId", "AssignedAt", "TenantId")
                SELECT gen_random_uuid(), identity."Id", role."Id", tenant."CreatedAt", tenant."Id"
                FROM "AspNetUsers" AS identity
                JOIN tenants AS tenant ON tenant."Id" = identity."TenantId"
                JOIN tenant_roles AS role ON role."TenantId" = tenant."Id" AND role."NormalizedName" = 'CLINICADMIN'
                JOIN "AspNetUserRoles" AS identity_assignment ON identity_assignment."UserId" = identity."Id"
                JOIN "AspNetRoles" AS identity_role ON identity_role."Id" = identity_assignment."RoleId"
                    AND identity_role."NormalizedName" = 'CLINICADMIN'
                ON CONFLICT ("TenantId", "UserId", "RoleId") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "user_role_assignments");

            migrationBuilder.DropTable(
                name: "clinic_users");

            migrationBuilder.DropTable(
                name: "tenant_roles");
        }
    }
}
