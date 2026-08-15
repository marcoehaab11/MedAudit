using System.Text.RegularExpressions;
using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed partial class TenantConfiguration : TenantOwnedEntity
{
    private TenantConfiguration() { }

    public TenantConfiguration(
        string culture,
        string timeZone,
        string currency,
        bool publicBookingEnabled = false,
        int publicBookingHorizonDays = 30,
        bool publicPriceVisibility = true)
    {
        Culture = NormalizeLanguage(culture);
        TimeZone = ValidateTimeZone(timeZone);
        Currency = ValidateCurrency(currency);
        PublicBookingEnabled = publicBookingEnabled;
        PublicBookingHorizonDays = Math.Clamp(publicBookingHorizonDays, 1, 365);
        PublicPriceVisibility = publicPriceVisibility;
        Version = Guid.NewGuid();
    }

    public static TenantConfiguration CreateForTenant(
        Guid tenantId,
        string culture,
        string timeZone,
        string currency,
        bool publicBookingEnabled = false,
        int publicBookingHorizonDays = 30,
        bool publicPriceVisibility = true)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        }

        return new TenantConfiguration(
            culture,
            timeZone,
            currency,
            publicBookingEnabled,
            publicBookingHorizonDays,
            publicPriceVisibility)
        { TenantId = tenantId };
    }

    // ── Legacy Core ───────────────────────────────────────────────────────────
    public string Culture { get; private set; } = "en";
    public string TimeZone { get; private set; } = "UTC";
    public string Currency { get; private set; } = "USD";
    public bool PublicBookingEnabled { get; private set; }
    public int PublicBookingHorizonDays { get; private set; } = 30;
    public bool PublicPriceVisibility { get; private set; } = true;

    // ── Concurrency ──────────────────────────────────────────────────────────
    public Guid Version { get; private set; } = Guid.NewGuid();

    // ── Profile Extensions ───────────────────────────────────────────────────
    public string? ArabicName { get; private set; }
    public string? Description { get; private set; }
    public string? ArabicDescription { get; private set; }
    public string? SecondaryPhone { get; private set; }
    public string? Website { get; private set; }
    public string? ArabicAddress { get; private set; }
    public string? TaxNumber { get; private set; }
    public string? FaviconReference { get; private set; }

    // ── Branding ─────────────────────────────────────────────────────────────
    public string PrimaryColor { get; private set; } = "#1e40af";
    public string SecondaryColor { get; private set; } = "#0284c7";
    public string AccentColor { get; private set; } = "#f59e0b";
    public string DefaultLanguage { get; private set; } = "en";
    public string SupportedLanguages { get; private set; } = "en,ar";
    public bool RtlEnabled { get; private set; }

    // ── Currency Presentation ────────────────────────────────────────────────
    public string CurrencySymbol { get; private set; } = "$";
    public int DecimalPrecision { get; private set; } = 2;
    public string SymbolPosition { get; private set; } = "Before";

    // ── Appointment Settings ─────────────────────────────────────────────────
    public int DefaultAppointmentDurationMinutes { get; private set; } = 30;
    public int MinimumBookingNoticeHours { get; private set; } = 2;
    public int MaxBookingHorizonDays { get; private set; } = 90;
    public int CancellationNoticeHours { get; private set; } = 24;
    public bool AllowSameDayBooking { get; private set; } = true;

    // ── Prescription Settings ────────────────────────────────────────────────
    public string PrescriptionPrefix { get; private set; } = "RX-";
    public string DefaultPrescriptionLanguage { get; private set; } = "en";
    public string DefaultInstructionsLanguage { get; private set; } = "en";
    public string DefaultInstructionsArabicLanguage { get; private set; } = "ar";
    public bool ShowClinicHeaderOnPdf { get; private set; } = true;
    public bool ShowDoctorSignatureOnPdf { get; private set; } = true;
    public bool EnableQrCodeOnPrint { get; private set; } = true;

    // ── Notification Preferences ──────────────────────────────────────────────
    public bool AppointmentsNotificationEnabled { get; private set; } = true;
    public bool PrescriptionsNotificationEnabled { get; private set; } = true;
    public bool PublicBookingNotificationEnabled { get; private set; } = true;
    public bool InAppNotificationsEnabled { get; private set; } = true;
    public bool EmailNotificationsEnabled { get; private set; } = true;
    public bool SmsNotificationsEnabled { get; private set; }
    public bool WhatsAppNotificationsEnabled { get; private set; }

    // ── Inventory Preferences ─────────────────────────────────────────────────
    public bool AllowNegativeStock { get; private set; }
    public bool RequireSupplierOnReceipt { get; private set; }
    public bool RequireReasonOnAdjustment { get; private set; } = true;

    // ── Pharmacy Preferences ──────────────────────────────────────────────────
    public bool PharmacyModuleEnabled { get; private set; } = true;
    public bool AllowPartialDispensing { get; private set; } = true;
    public bool RequirePharmacistRoleForDispensing { get; private set; }
    public bool RequireReversalReason { get; private set; } = true;

    // ── Finance Preferences ───────────────────────────────────────────────────
    public string DefaultPaymentMethod { get; private set; } = "Cash";
    public int FinancialPeriodStartMonth { get; private set; } = 1;
    public string ReceiptPrefix { get; private set; } = "REC-";
    public string ExpensePrefix { get; private set; } = "EXP-";

    // ── Section Update Methods ───────────────────────────────────────────────

    public void UpdateClinicProfile(
        string? arabicName,
        string? description,
        string? arabicDescription,
        string? secondaryPhone,
        string? website,
        string? arabicAddress,
        string? taxNumber,
        string? faviconReference,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        ArabicName = Optional(arabicName, 200);
        Description = Optional(description, 1000);
        ArabicDescription = Optional(arabicDescription, 1000);
        SecondaryPhone = Optional(secondaryPhone, 50);
        Website = Optional(website, 256);
        ArabicAddress = Optional(arabicAddress, 500);
        TaxNumber = Optional(taxNumber, 50);
        FaviconReference = Optional(faviconReference, 500);
        Touch();
    }

    public void UpdateBranding(
        string primaryColor,
        string secondaryColor,
        string accentColor,
        string defaultLanguage,
        string supportedLanguages,
        bool rtlEnabled,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        PrimaryColor = ValidateHexColor(primaryColor, nameof(primaryColor));
        SecondaryColor = ValidateHexColor(secondaryColor, nameof(secondaryColor));
        AccentColor = ValidateHexColor(accentColor, nameof(accentColor));
        DefaultLanguage = NormalizeLanguage(defaultLanguage);
        SupportedLanguages = string.IsNullOrWhiteSpace(supportedLanguages) ? "en,ar" : supportedLanguages.Trim();
        RtlEnabled = rtlEnabled;
        Touch();
    }

    public void UpdateTimezoneCurrency(
        string timeZone,
        string currency,
        string? currencySymbol,
        int decimalPrecision,
        string symbolPosition,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        TimeZone = ValidateTimeZone(timeZone);
        Currency = ValidateCurrency(currency);
        CurrencySymbol = string.IsNullOrWhiteSpace(currencySymbol) ? "$" : currencySymbol.Trim();
        DecimalPrecision = Math.Clamp(decimalPrecision, 0, 4);
        SymbolPosition = symbolPosition.Trim() == "After" ? "After" : "Before";
        Touch();
    }

    public void UpdatePublicBookingSettings(bool enabled, int horizonDays, bool priceVisibility)
    {
        PublicBookingEnabled = enabled;
        PublicBookingHorizonDays = Math.Clamp(horizonDays, 1, 365);
        PublicPriceVisibility = priceVisibility;
        Touch();
    }

    public void UpdateAppointmentSettings(
        int defaultDurationMinutes,
        int minimumBookingNoticeHours,
        int maxBookingHorizonDays,
        int cancellationNoticeHours,
        bool allowSameDayBooking,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        DefaultAppointmentDurationMinutes = Math.Clamp(defaultDurationMinutes, 5, 480);
        MinimumBookingNoticeHours = Math.Clamp(minimumBookingNoticeHours, 0, 72);
        MaxBookingHorizonDays = Math.Clamp(maxBookingHorizonDays, 1, 365);
        CancellationNoticeHours = Math.Clamp(cancellationNoticeHours, 0, 168);
        AllowSameDayBooking = allowSameDayBooking;
        Touch();
    }

    public void UpdatePrescriptionSettings(
        string prescriptionPrefix,
        string defaultLanguage,
        string defaultInstructionsLanguage,
        bool showClinicHeader,
        bool showDoctorSignature,
        bool enableQrCode,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        PrescriptionPrefix = string.IsNullOrWhiteSpace(prescriptionPrefix) ? "RX-" : prescriptionPrefix.Trim().ToUpperInvariant();
        DefaultPrescriptionLanguage = NormalizeLanguage(defaultLanguage);
        DefaultInstructionsLanguage = NormalizeLanguage(defaultInstructionsLanguage);
        ShowClinicHeaderOnPdf = showClinicHeader;
        ShowDoctorSignatureOnPdf = showDoctorSignature;
        EnableQrCodeOnPrint = enableQrCode;
        Touch();
    }

    public void UpdateNotificationSettings(
        bool appointmentsEnabled,
        bool prescriptionsEnabled,
        bool publicBookingEnabled,
        bool inAppEnabled,
        bool emailEnabled,
        bool smsEnabled,
        bool whatsAppEnabled,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        AppointmentsNotificationEnabled = appointmentsEnabled;
        PrescriptionsNotificationEnabled = prescriptionsEnabled;
        PublicBookingNotificationEnabled = publicBookingEnabled;
        InAppNotificationsEnabled = inAppEnabled;
        EmailNotificationsEnabled = emailEnabled;
        SmsNotificationsEnabled = smsEnabled;
        WhatsAppNotificationsEnabled = whatsAppEnabled;
        Touch();
    }

    public void UpdateInventorySettings(
        bool allowNegativeStock,
        bool requireSupplierOnReceipt,
        bool requireReasonOnAdjustment,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        AllowNegativeStock = allowNegativeStock;
        RequireSupplierOnReceipt = requireSupplierOnReceipt;
        RequireReasonOnAdjustment = requireReasonOnAdjustment;
        Touch();
    }

    public void UpdatePharmacySettings(
        bool pharmacyModuleEnabled,
        bool allowPartialDispensing,
        bool requirePharmacistRole,
        bool requireReversalReason,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        PharmacyModuleEnabled = pharmacyModuleEnabled;
        AllowPartialDispensing = allowPartialDispensing;
        RequirePharmacistRoleForDispensing = requirePharmacistRole;
        RequireReversalReason = requireReversalReason;
        Touch();
    }

    public void UpdateFinanceSettings(
        string defaultPaymentMethod,
        int financialPeriodStartMonth,
        string receiptPrefix,
        string expensePrefix,
        Guid currentVersion)
    {
        VerifyVersion(currentVersion);
        DefaultPaymentMethod = string.IsNullOrWhiteSpace(defaultPaymentMethod) ? "Cash" : defaultPaymentMethod.Trim();
        FinancialPeriodStartMonth = Math.Clamp(financialPeriodStartMonth, 1, 12);
        ReceiptPrefix = string.IsNullOrWhiteSpace(receiptPrefix) ? "REC-" : receiptPrefix.Trim().ToUpperInvariant();
        ExpensePrefix = string.IsNullOrWhiteSpace(expensePrefix) ? "EXP-" : expensePrefix.Trim().ToUpperInvariant();
        Touch();
    }

    private void VerifyVersion(Guid version)
    {
        if (Version != version)
        {
            throw new InvalidOperationException("Configuration has been modified by another user. Please reload and try again.");
        }
    }

    private void Touch()
    {
        Version = Guid.NewGuid();
    }

    private static string ValidateHexColor(string hex, string paramName)
    {
        if (string.IsNullOrWhiteSpace(hex) || !HexColorPattern().IsMatch(hex.Trim()))
        {
            throw new ArgumentException("Color must be a valid hex format (e.g. #1e40af).", paramName);
        }
        return hex.Trim();
    }

    private static string ValidateTimeZone(string timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone))
            throw new ArgumentException("Timezone is required.", nameof(timeZone));

        var tz = timeZone.Trim();
        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(tz);
            return tz;
        }
        catch
        {
            // Fallback for custom / standard IANA names
            if (tz == "UTC" || tz == "Africa/Cairo" || tz == "America/New_York" || tz == "Europe/London")
                return tz;

            throw new ArgumentException($"Invalid timezone identifier '{timeZone}'.", nameof(timeZone));
        }
    }

    private static string ValidateCurrency(string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Currency ISO code is required.", nameof(currency));

        var c = currency.Trim().ToUpperInvariant();
        if (c.Length != 3 || !CurrencyPattern().IsMatch(c))
        {
            throw new ArgumentException("Currency must be a 3-letter ISO code.", nameof(currency));
        }
        return c;
    }

    private static string NormalizeLanguage(string lang)
    {
        if (string.IsNullOrWhiteSpace(lang)) return "en";
        var l = lang.Trim().ToLowerInvariant();
        return l is "ar" or "arabic" ? "ar" : "en";
    }

    private static string? Optional(string? val, int maxLen)
    {
        if (string.IsNullOrWhiteSpace(val)) return null;
        var trimmed = val.Trim();
        return trimmed.Length > maxLen ? trimmed[..maxLen] : trimmed;
    }

    [GeneratedRegex("^#(?:[0-9a-fA-F]{3}){1,2}$", RegexOptions.CultureInvariant)]
    private static partial Regex HexColorPattern();

    [GeneratedRegex("^[A-Z]{3}$", RegexOptions.CultureInvariant)]
    private static partial Regex CurrencyPattern();
}
