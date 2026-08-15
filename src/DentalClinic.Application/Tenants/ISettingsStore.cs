using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public interface ISettingsStore
{
    Task<TenantConfiguration?> GetTenantConfigurationAsync(Guid tenantId, CancellationToken token);

    Task<Tenant?> GetTenantAsync(Guid tenantId, CancellationToken token);

    Task<IReadOnlyCollection<ClinicHours>> GetClinicHoursAsync(Guid tenantId, CancellationToken token);

    Task SaveClinicHoursAsync(Guid tenantId, IEnumerable<ClinicHours> hours, CancellationToken token);

    Task<IReadOnlyCollection<ClinicHoliday>> GetClinicHolidaysAsync(Guid tenantId, CancellationToken token);

    Task<ClinicHoliday?> GetHolidayByIdAsync(Guid tenantId, Guid holidayId, CancellationToken token);

    Task AddHolidayAsync(ClinicHoliday holiday, CancellationToken token);

    Task DeleteHolidayAsync(Guid tenantId, Guid holidayId, CancellationToken token);

    Task<UserPreference?> GetUserPreferenceAsync(Guid tenantId, Guid userId, CancellationToken token);

    Task SaveUserPreferenceAsync(UserPreference preference, CancellationToken token);

    void AddAudit(PlatformAuditLog audit);

    Task CommitAsync(CancellationToken token);
}

public interface ISettingsService
{
    Task<TenantSettingsDto> GetSettingsAsync(CancellationToken token);

    Task<TenantSettingsDto> UpdateClinicProfileAsync(UpdateClinicProfileCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateBrandingAsync(UpdateBrandingCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateTimezoneCurrencyAsync(UpdateTimezoneCurrencyCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateAppointmentSettingsAsync(UpdateAppointmentSettingsCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdatePrescriptionSettingsAsync(UpdatePrescriptionSettingsCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateNotificationSettingsAsync(UpdateNotificationSettingsCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateInventorySettingsAsync(UpdateInventorySettingsCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdatePharmacySettingsAsync(UpdatePharmacySettingsCommand command, CancellationToken token);

    Task<TenantSettingsDto> UpdateFinanceSettingsAsync(UpdateFinanceSettingsCommand command, CancellationToken token);

    Task<IReadOnlyCollection<ClinicHoursDto>> GetClinicHoursAsync(CancellationToken token);

    Task<IReadOnlyCollection<ClinicHoursDto>> UpdateClinicHoursAsync(UpdateClinicHoursCommand command, CancellationToken token);

    Task<IReadOnlyCollection<ClinicHolidayDto>> GetClinicHolidaysAsync(CancellationToken token);

    Task<ClinicHolidayDto> CreateClinicHolidayAsync(UpsertClinicHolidayCommand command, CancellationToken token);

    Task<ClinicHolidayDto> UpdateClinicHolidayAsync(Guid id, UpsertClinicHolidayCommand command, CancellationToken token);

    Task DeleteClinicHolidayAsync(Guid id, CancellationToken token);

    Task<UserPreferenceDto> GetUserPreferenceAsync(CancellationToken token);

    Task<UserPreferenceDto> UpdateUserPreferenceAsync(UpdateUserPreferenceCommand command, CancellationToken token);
}
