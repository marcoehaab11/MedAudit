using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class SettingsStore(ApplicationDbContext context) : ISettingsStore
{
    public async Task<TenantConfiguration?> GetTenantConfigurationAsync(Guid tenantId, CancellationToken token)
    {
        return await context.TenantConfigurations
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, token);
    }

    public async Task<Tenant?> GetTenantAsync(Guid tenantId, CancellationToken token)
    {
        return await context.Tenants
            .FirstOrDefaultAsync(x => x.Id == tenantId, token);
    }

    public async Task<IReadOnlyCollection<ClinicHours>> GetClinicHoursAsync(Guid tenantId, CancellationToken token)
    {
        return await context.ClinicHours
            .Include(x => x.Periods)
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.DayOfWeek)
            .ToListAsync(token);
    }

    public async Task SaveClinicHoursAsync(Guid tenantId, IEnumerable<ClinicHours> hours, CancellationToken token)
    {
        var existing = await context.ClinicHours
            .Include(x => x.Periods)
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(token);

        context.ClinicHours.RemoveRange(existing);

        foreach (var h in hours)
        {
            await context.ClinicHours.AddAsync(h, token);
        }
    }

    public async Task<IReadOnlyCollection<ClinicHoliday>> GetClinicHolidaysAsync(Guid tenantId, CancellationToken token)
    {
        return await context.ClinicHolidays
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync(token);
    }

    public async Task<ClinicHoliday?> GetHolidayByIdAsync(Guid tenantId, Guid holidayId, CancellationToken token)
    {
        return await context.ClinicHolidays
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == holidayId, token);
    }

    public async Task AddHolidayAsync(ClinicHoliday holiday, CancellationToken token)
    {
        await context.ClinicHolidays.AddAsync(holiday, token);
    }

    public async Task DeleteHolidayAsync(Guid tenantId, Guid holidayId, CancellationToken token)
    {
        var holiday = await GetHolidayByIdAsync(tenantId, holidayId, token);
        if (holiday != null)
        {
            context.ClinicHolidays.Remove(holiday);
        }
    }

    public async Task<UserPreference?> GetUserPreferenceAsync(Guid tenantId, Guid userId, CancellationToken token)
    {
        return await context.UserPreferences
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId, token);
    }

    public async Task SaveUserPreferenceAsync(UserPreference preference, CancellationToken token)
    {
        var existing = await GetUserPreferenceAsync(preference.TenantId, preference.UserId, token);
        if (existing == null)
        {
            await context.UserPreferences.AddAsync(preference, token);
        }
    }

    public async Task CommitAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }
}
