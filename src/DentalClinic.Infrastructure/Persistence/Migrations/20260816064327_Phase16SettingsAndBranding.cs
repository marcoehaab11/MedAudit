using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861

namespace DentalClinic.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase16SettingsAndBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccentColor",
                table: "tenant_configurations",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#f59e0b");

            migrationBuilder.AddColumn<bool>(
                name: "AllowNegativeStock",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AllowPartialDispensing",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AllowSameDayBooking",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AppointmentsNotificationEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ArabicAddress",
                table: "tenant_configurations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ArabicDescription",
                table: "tenant_configurations",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ArabicName",
                table: "tenant_configurations",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CancellationNoticeHours",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CurrencySymbol",
                table: "tenant_configurations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "$");

            migrationBuilder.AddColumn<int>(
                name: "DecimalPrecision",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DefaultAppointmentDurationMinutes",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DefaultInstructionsArabicLanguage",
                table: "tenant_configurations",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefaultInstructionsLanguage",
                table: "tenant_configurations",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "DefaultLanguage",
                table: "tenant_configurations",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "DefaultPaymentMethod",
                table: "tenant_configurations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Cash");

            migrationBuilder.AddColumn<string>(
                name: "DefaultPrescriptionLanguage",
                table: "tenant_configurations",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "tenant_configurations",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailNotificationsEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "EnableQrCodeOnPrint",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ExpensePrefix",
                table: "tenant_configurations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "EXP-");

            migrationBuilder.AddColumn<string>(
                name: "FaviconReference",
                table: "tenant_configurations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FinancialPeriodStartMonth",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "InAppNotificationsEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MaxBookingHorizonDays",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinimumBookingNoticeHours",
                table: "tenant_configurations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "PharmacyModuleEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PrescriptionPrefix",
                table: "tenant_configurations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "RX-");

            migrationBuilder.AddColumn<bool>(
                name: "PrescriptionsNotificationEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PrimaryColor",
                table: "tenant_configurations",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#1e40af");

            migrationBuilder.AddColumn<bool>(
                name: "PublicBookingNotificationEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptPrefix",
                table: "tenant_configurations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "REC-");

            migrationBuilder.AddColumn<bool>(
                name: "RequirePharmacistRoleForDispensing",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireReasonOnAdjustment",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireReversalReason",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireSupplierOnReceipt",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RtlEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SecondaryColor",
                table: "tenant_configurations",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#0284c7");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryPhone",
                table: "tenant_configurations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowClinicHeaderOnPdf",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowDoctorSignatureOnPdf",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SmsNotificationsEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SupportedLanguages",
                table: "tenant_configurations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "en,ar");

            migrationBuilder.AddColumn<string>(
                name: "SymbolPosition",
                table: "tenant_configurations",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Before");

            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                table: "tenant_configurations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "tenant_configurations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "tenant_configurations",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WhatsAppNotificationsEnabled",
                table: "tenant_configurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "medication_catalog_items",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InventoryItemId",
                table: "medication_catalog_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Manufacturer",
                table: "medication_catalog_items",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ReorderLevel",
                table: "medication_catalog_items",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "clinic_holidays",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ArabicName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsFullDay = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_holidays", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "clinic_hours",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    IsOpen = table.Column<bool>(type: "boolean", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_hours", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_dispensing_number_sequences",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastValue = table.Column<long>(type: "bigint", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_dispensing_number_sequences", x => new { x.TenantId, x.LastValue });
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_dispensing_reversals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DispensingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReversedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReversedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    StockMovementId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_dispensing_reversals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_dispensings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    DispensingNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DispensedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DispensedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_dispensings", x => x.Id);
                    table.UniqueConstraint("AK_pharmacy_dispensings_TenantId_Id", x => new { x.TenantId, x.Id });
                });

            migrationBuilder.CreateTable(
                name: "user_preferences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "en"),
                    Theme = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "Light"),
                    DateFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "YYYY-MM-DD"),
                    TimeFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "24h"),
                    StartOfWeek = table.Column<int>(type: "integer", nullable: false),
                    DefaultCalendarView = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "timeGridWeek"),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_preferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "clinic_hour_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicHoursId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    PeriodType = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clinic_hour_periods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_clinic_hour_periods_clinic_hours_ClinicHoursId",
                        column: x => x.ClinicHoursId,
                        principalTable: "clinic_hours",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pharmacy_dispensing_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DispensingId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuantityDispensed = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    StockMovementId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PharmacyDispensingId = table.Column<Guid>(type: "uuid", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pharmacy_dispensing_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pharmacy_dispensing_items_pharmacy_dispensings_PharmacyDisp~",
                        column: x => x.PharmacyDispensingId,
                        principalTable: "pharmacy_dispensings",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_medication_catalog_items_TenantId_Barcode",
                table: "medication_catalog_items",
                columns: new[] { "TenantId", "Barcode" });

            migrationBuilder.CreateIndex(
                name: "IX_clinic_holidays_TenantId_StartDate_EndDate",
                table: "clinic_holidays",
                columns: new[] { "TenantId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_clinic_hour_periods_ClinicHoursId",
                table: "clinic_hour_periods",
                column: "ClinicHoursId");

            migrationBuilder.CreateIndex(
                name: "IX_clinic_hours_TenantId_DayOfWeek",
                table: "clinic_hours",
                columns: new[] { "TenantId", "DayOfWeek" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensing_items_PharmacyDispensingId",
                table: "pharmacy_dispensing_items",
                column: "PharmacyDispensingId");

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensing_items_TenantId_DispensingId",
                table: "pharmacy_dispensing_items",
                columns: new[] { "TenantId", "DispensingId" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensing_items_TenantId_InventoryItemId",
                table: "pharmacy_dispensing_items",
                columns: new[] { "TenantId", "InventoryItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensing_items_TenantId_PrescriptionItemId",
                table: "pharmacy_dispensing_items",
                columns: new[] { "TenantId", "PrescriptionItemId" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensing_reversals_TenantId_DispensingId",
                table: "pharmacy_dispensing_reversals",
                columns: new[] { "TenantId", "DispensingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensings_TenantId_DispensedByUserId_DispensedAt",
                table: "pharmacy_dispensings",
                columns: new[] { "TenantId", "DispensedByUserId", "DispensedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensings_TenantId_DispensingNumber",
                table: "pharmacy_dispensings",
                columns: new[] { "TenantId", "DispensingNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensings_TenantId_PatientId_DispensedAt",
                table: "pharmacy_dispensings",
                columns: new[] { "TenantId", "PatientId", "DispensedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pharmacy_dispensings_TenantId_PrescriptionId",
                table: "pharmacy_dispensings",
                columns: new[] { "TenantId", "PrescriptionId" });

            migrationBuilder.CreateIndex(
                name: "IX_user_preferences_TenantId_UserId",
                table: "user_preferences",
                columns: new[] { "TenantId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "clinic_holidays");

            migrationBuilder.DropTable(
                name: "clinic_hour_periods");

            migrationBuilder.DropTable(
                name: "pharmacy_dispensing_items");

            migrationBuilder.DropTable(
                name: "pharmacy_dispensing_number_sequences");

            migrationBuilder.DropTable(
                name: "pharmacy_dispensing_reversals");

            migrationBuilder.DropTable(
                name: "user_preferences");

            migrationBuilder.DropTable(
                name: "clinic_hours");

            migrationBuilder.DropTable(
                name: "pharmacy_dispensings");

            migrationBuilder.DropIndex(
                name: "IX_medication_catalog_items_TenantId_Barcode",
                table: "medication_catalog_items");

            migrationBuilder.DropColumn(
                name: "AccentColor",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "AllowNegativeStock",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "AllowPartialDispensing",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "AllowSameDayBooking",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "AppointmentsNotificationEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ArabicAddress",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ArabicDescription",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ArabicName",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "CancellationNoticeHours",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "CurrencySymbol",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DecimalPrecision",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultAppointmentDurationMinutes",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultInstructionsArabicLanguage",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultInstructionsLanguage",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultLanguage",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultPaymentMethod",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "DefaultPrescriptionLanguage",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "EmailNotificationsEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "EnableQrCodeOnPrint",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ExpensePrefix",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "FaviconReference",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "FinancialPeriodStartMonth",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "InAppNotificationsEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "MaxBookingHorizonDays",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "MinimumBookingNoticeHours",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PharmacyModuleEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PrescriptionPrefix",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PrescriptionsNotificationEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PrimaryColor",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "PublicBookingNotificationEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ReceiptPrefix",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "RequirePharmacistRoleForDispensing",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "RequireReasonOnAdjustment",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "RequireReversalReason",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "RequireSupplierOnReceipt",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "RtlEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "SecondaryColor",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "SecondaryPhone",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ShowClinicHeaderOnPdf",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "ShowDoctorSignatureOnPdf",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "SmsNotificationsEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "SupportedLanguages",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "SymbolPosition",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "TaxNumber",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "WhatsAppNotificationsEnabled",
                table: "tenant_configurations");

            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "medication_catalog_items");

            migrationBuilder.DropColumn(
                name: "InventoryItemId",
                table: "medication_catalog_items");

            migrationBuilder.DropColumn(
                name: "Manufacturer",
                table: "medication_catalog_items");

            migrationBuilder.DropColumn(
                name: "ReorderLevel",
                table: "medication_catalog_items");
        }
    }
}
