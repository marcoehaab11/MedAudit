using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public sealed record TenantSettingsDto(
    Guid TenantId,
    string ClinicName,
    string? ArabicName,
    string Slug,
    string Phone,
    string? SecondaryPhone,
    string Email,
    string? Website,
    string Address,
    string? ArabicAddress,
    string City,
    string Country,
    string? TaxNumber,
    string? LogoReference,
    string? FaviconReference,
    string Description,
    string? ArabicDescription,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string DefaultLanguage,
    string SupportedLanguages,
    bool RtlEnabled,
    string TimeZone,
    string Currency,
    string CurrencySymbol,
    int DecimalPrecision,
    string SymbolPosition,
    bool PublicBookingEnabled,
    int PublicBookingHorizonDays,
    bool PublicPriceVisibility,
    int DefaultAppointmentDurationMinutes,
    int MinimumBookingNoticeHours,
    int MaxBookingHorizonDays,
    int CancellationNoticeHours,
    bool AllowSameDayBooking,
    string PrescriptionPrefix,
    string DefaultPrescriptionLanguage,
    string DefaultInstructionsLanguage,
    bool ShowClinicHeaderOnPdf,
    bool ShowDoctorSignatureOnPdf,
    bool EnableQrCodeOnPrint,
    bool AppointmentsNotificationEnabled,
    bool PrescriptionsNotificationEnabled,
    bool PublicBookingNotificationEnabled,
    bool InAppNotificationsEnabled,
    bool EmailNotificationsEnabled,
    bool SmsNotificationsEnabled,
    bool WhatsAppNotificationsEnabled,
    bool AllowNegativeStock,
    bool RequireSupplierOnReceipt,
    bool RequireReasonOnAdjustment,
    bool PharmacyModuleEnabled,
    bool AllowPartialDispensing,
    bool RequirePharmacistRoleForDispensing,
    bool RequireReversalReason,
    string DefaultPaymentMethod,
    int FinancialPeriodStartMonth,
    string ReceiptPrefix,
    string ExpensePrefix,
    Guid Version
);

public sealed record UpdateClinicProfileCommand(
    string Name,
    string? ArabicName,
    string Phone,
    string? SecondaryPhone,
    string Email,
    string? Website,
    string Address,
    string? ArabicAddress,
    string City,
    string Country,
    string? TaxNumber,
    string? Description,
    string? ArabicDescription,
    string? LogoReference,
    string? FaviconReference,
    Guid Version
);

public sealed record UpdateBrandingCommand(
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string DefaultLanguage,
    string SupportedLanguages,
    bool RtlEnabled,
    Guid Version
);

public sealed record UpdateTimezoneCurrencyCommand(
    string TimeZone,
    string Currency,
    string? CurrencySymbol,
    int DecimalPrecision,
    string SymbolPosition,
    Guid Version
);

public sealed record UpdateAppointmentSettingsCommand(
    int DefaultAppointmentDurationMinutes,
    int MinimumBookingNoticeHours,
    int MaxBookingHorizonDays,
    int CancellationNoticeHours,
    bool AllowSameDayBooking,
    bool PublicBookingEnabled,
    int PublicBookingHorizonDays,
    bool PublicPriceVisibility,
    Guid Version
);

public sealed record UpdatePrescriptionSettingsCommand(
    string PrescriptionPrefix,
    string DefaultPrescriptionLanguage,
    string DefaultInstructionsLanguage,
    bool ShowClinicHeaderOnPdf,
    bool ShowDoctorSignatureOnPdf,
    bool EnableQrCodeOnPrint,
    Guid Version
);

public sealed record UpdateNotificationSettingsCommand(
    bool AppointmentsNotificationEnabled,
    bool PrescriptionsNotificationEnabled,
    bool PublicBookingNotificationEnabled,
    bool InAppNotificationsEnabled,
    bool EmailNotificationsEnabled,
    bool SmsNotificationsEnabled,
    bool WhatsAppNotificationsEnabled,
    Guid Version
);

public sealed record UpdateInventorySettingsCommand(
    bool AllowNegativeStock,
    bool RequireSupplierOnReceipt,
    bool RequireReasonOnAdjustment,
    Guid Version
);

public sealed record UpdatePharmacySettingsCommand(
    bool PharmacyModuleEnabled,
    bool AllowPartialDispensing,
    bool RequirePharmacistRoleForDispensing,
    bool RequireReversalReason,
    Guid Version
);

public sealed record UpdateFinanceSettingsCommand(
    string DefaultPaymentMethod,
    int FinancialPeriodStartMonth,
    string ReceiptPrefix,
    string ExpensePrefix,
    Guid Version
);

public sealed record ClinicHoursDto(
    DayOfWeek DayOfWeek,
    bool IsOpen,
    IReadOnlyCollection<ClinicHourPeriodDto> Periods
);

public sealed record ClinicHourPeriodDto(
    string StartTime,
    string EndTime,
    ClinicPeriodType PeriodType
);

public sealed record UpdateClinicHoursCommand(
    IReadOnlyCollection<ClinicHoursDto> Hours
);

public sealed record ClinicHolidayDto(
    Guid Id,
    string Name,
    string? ArabicName,
    DateOnly StartDate,
    DateOnly EndDate,
    string? StartTime,
    string? EndTime,
    string? Reason,
    bool IsFullDay,
    bool IsActive,
    DateTimeOffset CreatedAt
);

public sealed record UpsertClinicHolidayCommand(
    string Name,
    string? ArabicName,
    DateOnly StartDate,
    DateOnly EndDate,
    string? StartTime,
    string? EndTime,
    string? Reason,
    bool IsFullDay,
    bool IsActive
);

public sealed record UserPreferenceDto(
    string Language,
    string Theme,
    string DateFormat,
    string TimeFormat,
    int StartOfWeek,
    string DefaultCalendarView
);

public sealed record UpdateUserPreferenceCommand(
    string Language,
    string Theme,
    string DateFormat,
    string TimeFormat,
    int StartOfWeek,
    string DefaultCalendarView
);
