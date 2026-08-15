using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

internal sealed class SettingsService(
    ISettingsStore store,
    ICurrentTenant currentTenant,
    ICurrentUser currentUser,
    IPermissionService permissions,
    ISystemClock clock,
    IPlatformAuditLogger auditLogger
) : ISettingsService
{
    public async Task<TenantSettingsDto> GetSettingsAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsView, token);
        var tenantId = currentTenant.RequireTenantId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateClinicProfileAsync(UpdateClinicProfileCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsClinicProfile, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        tenant.Update(
            command.Name,
            tenant.Slug,
            command.Phone,
            command.Email,
            command.Address,
            command.City,
            command.Country,
            tenant.TimeZone,
            tenant.Currency,
            clock.UtcNow,
            command.LogoReference
        );

        config.UpdateClinicProfile(
            command.ArabicName,
            command.Description,
            command.ArabicDescription,
            command.SecondaryPhone,
            command.Website,
            command.ArabicAddress,
            command.TaxNumber,
            command.FaviconReference,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsClinicProfileUpdated,
            userId,
            "Updated clinic profile details.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateBrandingAsync(UpdateBrandingCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsBranding, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdateBranding(
            command.PrimaryColor,
            command.SecondaryColor,
            command.AccentColor,
            command.DefaultLanguage,
            command.SupportedLanguages,
            command.RtlEnabled,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsBrandingUpdated,
            userId,
            "Updated clinic branding and localization options.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateTimezoneCurrencyAsync(UpdateTimezoneCurrencyCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsEdit, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        tenant.Update(
            tenant.Name,
            tenant.Slug,
            tenant.Phone,
            tenant.Email,
            tenant.Address,
            tenant.City,
            tenant.Country,
            command.TimeZone,
            command.Currency,
            clock.UtcNow,
            tenant.LogoReference
        );

        config.UpdateTimezoneCurrency(
            command.TimeZone,
            command.Currency,
            command.CurrencySymbol,
            command.DecimalPrecision,
            command.SymbolPosition,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsTimezoneCurrencyUpdated,
            userId,
            $"Updated timezone to '{command.TimeZone}' and currency to '{command.Currency}'.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateAppointmentSettingsAsync(UpdateAppointmentSettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsAppointments, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdateAppointmentSettings(
            command.DefaultAppointmentDurationMinutes,
            command.MinimumBookingNoticeHours,
            command.MaxBookingHorizonDays,
            command.CancellationNoticeHours,
            command.AllowSameDayBooking,
            command.Version
        );

        config.UpdatePublicBookingSettings(
            command.PublicBookingEnabled,
            command.PublicBookingHorizonDays,
            command.PublicPriceVisibility
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated appointment scheduling and public booking configuration.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdatePrescriptionSettingsAsync(UpdatePrescriptionSettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsPrescriptions, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdatePrescriptionSettings(
            command.PrescriptionPrefix,
            command.DefaultPrescriptionLanguage,
            command.DefaultInstructionsLanguage,
            command.ShowClinicHeaderOnPdf,
            command.ShowDoctorSignatureOnPdf,
            command.EnableQrCodeOnPrint,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated prescription print & formatting configuration.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateNotificationSettingsAsync(UpdateNotificationSettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsNotifications, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdateNotificationSettings(
            command.AppointmentsNotificationEnabled,
            command.PrescriptionsNotificationEnabled,
            command.PublicBookingNotificationEnabled,
            command.InAppNotificationsEnabled,
            command.EmailNotificationsEnabled,
            command.SmsNotificationsEnabled,
            command.WhatsAppNotificationsEnabled,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated notification channel preferences.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateInventorySettingsAsync(UpdateInventorySettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsInventory, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdateInventorySettings(
            command.AllowNegativeStock,
            command.RequireSupplierOnReceipt,
            command.RequireReasonOnAdjustment,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated inventory policies.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdatePharmacySettingsAsync(UpdatePharmacySettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsPharmacy, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdatePharmacySettings(
            command.PharmacyModuleEnabled,
            command.AllowPartialDispensing,
            command.RequirePharmacistRoleForDispensing,
            command.RequireReversalReason,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated pharmacy operation preferences.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<TenantSettingsDto> UpdateFinanceSettingsAsync(UpdateFinanceSettingsCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsFinance, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var config = await GetOrCreateConfigAsync(tenantId, token);
        var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant profile missing.");

        config.UpdateFinanceSettings(
            command.DefaultPaymentMethod,
            command.FinancialPeriodStartMonth,
            command.ReceiptPrefix,
            command.ExpensePrefix,
            command.Version
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsModuleConfigUpdated,
            userId,
            "Updated finance settings and receipt prefixes.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapSettings(tenant, config);
    }

    public async Task<IReadOnlyCollection<ClinicHoursDto>> GetClinicHoursAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsView, token);
        var tenantId = currentTenant.RequireTenantId();
        var hours = await store.GetClinicHoursAsync(tenantId, token);
        return MapClinicHours(hours);
    }

    public async Task<IReadOnlyCollection<ClinicHoursDto>> UpdateClinicHoursAsync(UpdateClinicHoursCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsAppointments, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var entities = new List<ClinicHours>();
        foreach (var h in command.Hours)
        {
            var ch = new ClinicHours(tenantId, h.DayOfWeek, h.IsOpen);
            var periods = h.Periods.Select(p => new ClinicHourPeriod(
                TimeOnly.Parse(p.StartTime),
                TimeOnly.Parse(p.EndTime),
                p.PeriodType
            ));
            ch.SetPeriods(periods);
            entities.Add(ch);
        }

        await store.SaveClinicHoursAsync(tenantId, entities, token);
        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsClinicHoursUpdated,
            userId,
            "Updated clinic working hours and operational breaks.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapClinicHours(entities);
    }

    public async Task<IReadOnlyCollection<ClinicHolidayDto>> GetClinicHolidaysAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsView, token);
        var tenantId = currentTenant.RequireTenantId();
        var list = await store.GetClinicHolidaysAsync(tenantId, token);
        return list.Select(MapHoliday).ToList();
    }

    public async Task<ClinicHolidayDto> CreateClinicHolidayAsync(UpsertClinicHolidayCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsAppointments, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        TimeOnly? sTime = !string.IsNullOrWhiteSpace(command.StartTime) ? TimeOnly.Parse(command.StartTime) : null;
        TimeOnly? eTime = !string.IsNullOrWhiteSpace(command.EndTime) ? TimeOnly.Parse(command.EndTime) : null;

        var holiday = new ClinicHoliday(
            tenantId,
            command.Name,
            command.ArabicName,
            command.StartDate,
            command.EndDate,
            sTime,
            eTime,
            command.Reason,
            command.IsFullDay,
            clock.UtcNow
        );

        await store.AddHolidayAsync(holiday, token);
        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsHolidayCreated,
            userId,
            $"Created clinic holiday '{holiday.Name}'.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapHoliday(holiday);
    }

    public async Task<ClinicHolidayDto> UpdateClinicHolidayAsync(Guid id, UpsertClinicHolidayCommand command, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsAppointments, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var holiday = await store.GetHolidayByIdAsync(tenantId, id, token) ?? throw new KeyNotFoundException("Clinic holiday not found.");

        TimeOnly? sTime = !string.IsNullOrWhiteSpace(command.StartTime) ? TimeOnly.Parse(command.StartTime) : null;
        TimeOnly? eTime = !string.IsNullOrWhiteSpace(command.EndTime) ? TimeOnly.Parse(command.EndTime) : null;

        holiday.Update(
            command.Name,
            command.ArabicName,
            command.StartDate,
            command.EndDate,
            sTime,
            eTime,
            command.Reason,
            command.IsFullDay,
            command.IsActive,
            clock.UtcNow
        );

        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsHolidayUpdated,
            userId,
            $"Updated clinic holiday '{holiday.Name}'.",
            tenantId,
            clock.UtcNow,
            token
        );

        return MapHoliday(holiday);
    }

    public async Task DeleteClinicHolidayAsync(Guid id, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.SettingsAppointments, token);
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        await store.DeleteHolidayAsync(tenantId, id, token);
        await store.CommitAsync(token);

        await auditLogger.LogAsync(
            PlatformAuditAction.SettingsHolidayDeleted,
            userId,
            $"Deleted clinic holiday ID '{id}'.",
            tenantId,
            clock.UtcNow,
            token
        );
    }

    public async Task<UserPreferenceDto> GetUserPreferenceAsync(CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var pref = await store.GetUserPreferenceAsync(tenantId, userId, token);
        return pref == null
            ? new UserPreferenceDto("en", "Light", "YYYY-MM-DD", "24h", 0, "timeGridWeek")
            : MapPreference(pref);
    }

    public async Task<UserPreferenceDto> UpdateUserPreferenceAsync(UpdateUserPreferenceCommand command, CancellationToken token)
    {
        var tenantId = currentTenant.RequireTenantId();
        var userId = RequireUserId();

        var pref = await store.GetUserPreferenceAsync(tenantId, userId, token);
        if (pref == null)
        {
            pref = new UserPreference(tenantId, userId);
        }

        pref.Update(
            command.Language,
            command.Theme,
            command.DateFormat,
            command.TimeFormat,
            command.StartOfWeek,
            command.DefaultCalendarView
        );

        await store.SaveUserPreferenceAsync(pref, token);
        await store.CommitAsync(token);

        return MapPreference(pref);
    }

    // ── Helper Mapping Methods ───────────────────────────────────────────────

    private async Task<TenantConfiguration> GetOrCreateConfigAsync(Guid tenantId, CancellationToken token)
    {
        var config = await store.GetTenantConfigurationAsync(tenantId, token);
        if (config == null)
        {
            var tenant = await store.GetTenantAsync(tenantId, token) ?? throw new InvalidOperationException("Tenant not found.");
            config = TenantConfiguration.CreateForTenant(tenantId, "en", tenant.TimeZone, tenant.Currency);
        }
        return config;
    }

    private static TenantSettingsDto MapSettings(Tenant tenant, TenantConfiguration config) => new(
        tenant.Id,
        tenant.Name,
        config.ArabicName,
        tenant.Slug,
        tenant.Phone,
        config.SecondaryPhone,
        tenant.Email,
        config.Website,
        tenant.Address,
        config.ArabicAddress,
        tenant.City,
        tenant.Country,
        config.TaxNumber,
        tenant.LogoReference,
        config.FaviconReference,
        config.Description ?? string.Empty,
        config.ArabicDescription,
        config.PrimaryColor,
        config.SecondaryColor,
        config.AccentColor,
        config.DefaultLanguage,
        config.SupportedLanguages,
        config.RtlEnabled,
        config.TimeZone,
        config.Currency,
        config.CurrencySymbol,
        config.DecimalPrecision,
        config.SymbolPosition,
        config.PublicBookingEnabled,
        config.PublicBookingHorizonDays,
        config.PublicPriceVisibility,
        config.DefaultAppointmentDurationMinutes,
        config.MinimumBookingNoticeHours,
        config.MaxBookingHorizonDays,
        config.CancellationNoticeHours,
        config.AllowSameDayBooking,
        config.PrescriptionPrefix,
        config.DefaultPrescriptionLanguage,
        config.DefaultInstructionsLanguage,
        config.ShowClinicHeaderOnPdf,
        config.ShowDoctorSignatureOnPdf,
        config.EnableQrCodeOnPrint,
        config.AppointmentsNotificationEnabled,
        config.PrescriptionsNotificationEnabled,
        config.PublicBookingNotificationEnabled,
        config.InAppNotificationsEnabled,
        config.EmailNotificationsEnabled,
        config.SmsNotificationsEnabled,
        config.WhatsAppNotificationsEnabled,
        config.AllowNegativeStock,
        config.RequireSupplierOnReceipt,
        config.RequireReasonOnAdjustment,
        config.PharmacyModuleEnabled,
        config.AllowPartialDispensing,
        config.RequirePharmacistRoleForDispensing,
        config.RequireReversalReason,
        config.DefaultPaymentMethod,
        config.FinancialPeriodStartMonth,
        config.ReceiptPrefix,
        config.ExpensePrefix,
        config.Version
    );

    private static IReadOnlyCollection<ClinicHoursDto> MapClinicHours(IEnumerable<ClinicHours> hours)
    {
        return hours.Select(h => new ClinicHoursDto(
            h.DayOfWeek,
            h.IsOpen,
            h.Periods.Select(p => new ClinicHourPeriodDto(p.StartTime.ToString("HH:mm"), p.EndTime.ToString("HH:mm"), p.PeriodType)).ToList()
        )).ToList();
    }

    private static ClinicHolidayDto MapHoliday(ClinicHoliday h) => new(
        h.Id,
        h.Name,
        h.ArabicName,
        h.StartDate,
        h.EndDate,
        h.StartTime?.ToString("HH:mm"),
        h.EndTime?.ToString("HH:mm"),
        h.Reason,
        h.IsFullDay,
        h.IsActive,
        h.CreatedAt
    );

    private static UserPreferenceDto MapPreference(UserPreference p) => new(
        p.Language,
        p.Theme,
        p.DateFormat,
        p.TimeFormat,
        p.StartOfWeek,
        p.DefaultCalendarView
    );

    private Guid RequireUserId() => currentUser.UserId ?? throw new UnauthorizedAccessException("User is not authenticated.");
}
