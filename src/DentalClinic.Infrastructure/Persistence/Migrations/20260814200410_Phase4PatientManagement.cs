using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase4PatientManagement : Migration
    {
        private static readonly string[] TenantPatientColumns = ["TenantId", "PatientId"];
        private static readonly string[] TenantIdentityColumns = ["TenantId", "Id"];
        private static readonly string[] TenantPatientNumberColumns = ["TenantId", "PatientNumber"];
        private static readonly string[] TenantPhoneColumns = ["TenantId", "Phone"];
        private static readonly string[] TenantNameColumns = ["TenantId", "LastName", "FirstName"];
        private static readonly string[] TenantStatusCreatedColumns = ["TenantId", "Status", "CreatedAt"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "patient_number_sequences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Prefix = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    LastValue = table.Column<long>(type: "bigint", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_number_sequences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_number_sequences_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "patients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MiddleName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LastName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Gender = table.Column<int>(type: "integer", nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AlternatePhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EmergencyContactName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    EmergencyContactPhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Nationality = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Occupation = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    MaritalStatus = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MedicalNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patients", x => x.Id);
                    table.UniqueConstraint("AK_patients_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_patients_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "patient_allergies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_allergies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_allergies_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: TenantIdentityColumns,
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "patient_medical_conditions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_medical_conditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_medical_conditions_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: TenantIdentityColumns,
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "patient_medications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Dosage = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_medications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_medications_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: TenantIdentityColumns,
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "patient_surgeries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Procedure = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ProcedureDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_patient_surgeries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_patient_surgeries_patients_TenantId_PatientId",
                        columns: x => new { x.TenantId, x.PatientId },
                        principalTable: "patients",
                        principalColumns: TenantIdentityColumns,
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_patient_allergies_TenantId_PatientId",
                table: "patient_allergies",
                columns: TenantPatientColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patient_medical_conditions_TenantId_PatientId",
                table: "patient_medical_conditions",
                columns: TenantPatientColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patient_medications_TenantId_PatientId",
                table: "patient_medications",
                columns: TenantPatientColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patient_number_sequences_TenantId",
                table: "patient_number_sequences",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_patient_surgeries_TenantId_PatientId",
                table: "patient_surgeries",
                columns: TenantPatientColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patients_TenantId_LastName_FirstName",
                table: "patients",
                columns: TenantNameColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patients_TenantId_PatientNumber",
                table: "patients",
                columns: TenantPatientNumberColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_patients_TenantId_Phone",
                table: "patients",
                columns: TenantPhoneColumns);

            migrationBuilder.CreateIndex(
                name: "IX_patients_TenantId_Status_CreatedAt",
                table: "patients",
                columns: TenantStatusCreatedColumns);

            migrationBuilder.Sql(
                """
                INSERT INTO role_permissions ("Id", "RoleId", "Permission", "TenantId")
                SELECT gen_random_uuid(), role."Id", permission.name, role."TenantId"
                FROM tenant_roles AS role
                CROSS JOIN (VALUES ('Patients.ViewMedicalHistory'), ('Patients.EditMedicalHistory')) AS permission(name)
                WHERE role."NormalizedName" IN ('CLINICADMIN', 'DOCTOR')
                ON CONFLICT ("TenantId", "RoleId", "Permission") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM role_permissions
                WHERE "Permission" IN ('Patients.ViewMedicalHistory', 'Patients.EditMedicalHistory');
                """);

            migrationBuilder.DropTable(
                name: "patient_allergies");

            migrationBuilder.DropTable(
                name: "patient_medical_conditions");

            migrationBuilder.DropTable(
                name: "patient_medications");

            migrationBuilder.DropTable(
                name: "patient_number_sequences");

            migrationBuilder.DropTable(
                name: "patient_surgeries");

            migrationBuilder.DropTable(
                name: "patients");
        }
    }
}
