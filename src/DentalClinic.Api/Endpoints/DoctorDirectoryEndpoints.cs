using System.Globalization;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static class DoctorDirectoryEndpoints
{
    public static void MapDoctorDirectory(this RouteGroupBuilder doctors)
    {
        doctors.MapGet("/directory", SearchAsync).RequireAuthorization(Permissions.DoctorsView);
        doctors.MapGet("/{id:guid}/dues", DuesAsync).RequireAuthorization(
            Permissions.DoctorsView, Permissions.FinanceDoctorCompensationView);
    }

    private static async Task<IResult> SearchAsync(string? month, ApplicationDbContext db, ISystemClock clock,
        IPermissionService permissions, IFinanceStore finance, CancellationToken token)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(await db.TenantConfigurations
            .Select(x => x.TimeZone).SingleAsync(token));
        var now = TimeZoneInfo.ConvertTime(clock.UtcNow, zone);
        var start = new DateOnly(now.Year, now.Month, 1);
        if (!string.IsNullOrEmpty(month) && (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd",
            CultureInfo.InvariantCulture, DateTimeStyles.None, out start) || start.Year is < 1900 or > 9998))
            return Results.BadRequest(new { message = "Choose a valid calendar month." });
        var from = Boundary(start, zone);
        var to = Boundary(start.AddMonths(1), zone);
        var doctors = await (from doctor in db.DoctorProfiles.AsNoTracking()
                             join user in db.ClinicUsers.AsNoTracking() on doctor.ClinicUserId equals user.Id
                             orderby user.DisplayName, doctor.Id
                             select new
                             {
                                 doctor.Id,
                                 doctor.TenantId,
                                 user.DisplayName,
                                 user.Phone,
                                 doctor.Specialization,
                                 AccountStatus = user.Status,
                                 ProfileStatus = doctor.Status
                             })
            .ToArrayAsync(token);
        var hours = await db.ClinicHours.AsNoTracking().Include(x => x.Periods).ToArrayAsync(token);
        var schedule = await db.DoctorSchedules.AsNoTracking().Include(x => x.Breaks).ToArrayAsync(token);
        var byDoctor = schedule.ToLookup(x => x.DoctorProfileId);
        var attended = db.Appointments.AsNoTracking()
            .Where(x => x.Status == AppointmentStatus.CheckedIn || x.Status == AppointmentStatus.InProgress ||
                x.Status == AppointmentStatus.Completed);
        // The visit date stays attached to the appointment when attendance is corrected later.
        var activity = await attended.Where(x => x.StartAt >= from && x.StartAt < to)
            .GroupBy(x => x.DoctorProfileId).Select(g => new
            {
                DoctorId = g.Key,
                Total = g.Count(),
                FollowUps = g.Count(x => x.Type == AppointmentType.FollowUp),
            }).ToDictionaryAsync(x => x.DoctorId, token);
        var firstVisits = await attended.Where(x => x.StartAt < to)
            .GroupBy(x => new { x.DoctorProfileId, x.PatientId })
            .Select(g => new { g.Key.DoctorProfileId, FirstVisit = g.Min(x => x.StartAt) })
            .Where(x => x.FirstVisit >= from).GroupBy(x => x.DoctorProfileId)
            .Select(g => new { DoctorId = g.Key, NewPatients = g.Count() })
            .ToDictionaryAsync(x => x.DoctorId, x => x.NewPatients, token);
        var canReadDues = await permissions.HasPermissionAsync(Permissions.FinanceDoctorCompensationView, token);
        var dues = canReadDues ? await finance.DoctorDuesAsync(doctors.Select(x => x.Id).ToArray(), token) : null;
        return Results.Ok(new
        {
            Month = start.ToString("yyyy-MM", CultureInfo.InvariantCulture),
            Items = doctors.Select(x => new
            {
                x.Id,
                x.DisplayName,
                x.Phone,
                x.Specialization,
                x.AccountStatus,
                x.ProfileStatus,
                WorkingDays = ClinicAppointmentSchedule.Resolve(x.TenantId, x.Id, hours, byDoctor[x.Id].ToArray())
                    .Select(day => (int)day.DayOfWeek).Distinct().Order().ToArray(),
                NewPatients = firstVisits.GetValueOrDefault(x.Id),
                FollowUps = activity.GetValueOrDefault(x.Id)?.FollowUps ?? 0,
                TotalVisits = activity.GetValueOrDefault(x.Id)?.Total ?? 0,
                Dues = dues?.GetValueOrDefault(x.Id),
            }),
        });
    }

    private static async Task<IResult> DuesAsync(Guid id, ApplicationDbContext db, IFinanceStore finance,
        ISystemClock clock, CancellationToken token)
    {
        var doctor = await (from profile in db.DoctorProfiles.AsNoTracking()
                            join user in db.ClinicUsers.AsNoTracking() on profile.ClinicUserId equals user.Id
                            where profile.Id == id
                            select new { profile.Id, user.DisplayName, profile.Specialization }).SingleOrDefaultAsync(token);
        if (doctor is null) return Results.NotFound();
        var zone = TimeZoneInfo.FindSystemTimeZoneById(await db.TenantConfigurations
            .Select(x => x.TimeZone).SingleAsync(token));
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow, zone).DateTime);
        var rule = await finance.FindCompensationRuleAsync(id, today, token);
        var dues = (await finance.DoctorDuesAsync([id], token))[id];
        return Results.Ok(new
        {
            doctor.Id,
            doctor.DisplayName,
            doctor.Specialization,
            Dues = dues,
            Percentage = rule?.Percentage,
            CommissionBasis = rule is { Percentage: not null } ? (int?)rule.CommissionBasis : null,
        });
    }

    private static DateTimeOffset Boundary(DateOnly date, TimeZoneInfo zone) =>
        new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), zone), TimeSpan.Zero);
}
