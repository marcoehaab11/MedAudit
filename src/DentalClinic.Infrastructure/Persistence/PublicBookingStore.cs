using DentalClinic.Application.Appointments;
using DentalClinic.Application.PublicBooking;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PublicBookingStore(ApplicationDbContext context) : IPublicBookingStore
{
    public async Task<PublicClinicDto?> FindClinicBySlugAsync(string slug, CancellationToken token)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();

        return await (from t in context.Tenants.AsNoTracking().IgnoreQueryFilters()
                      join c in context.TenantConfigurations.AsNoTracking().IgnoreQueryFilters() on t.Id equals c.TenantId
                      where t.Slug == normalizedSlug && t.Status == TenantStatus.Active
                      select new PublicClinicDto(
                          t.Name,
                          t.Slug,
                          t.Phone,
                          t.Email,
                          t.Address,
                          t.City,
                          t.Country,
                          c.TimeZone,
                          c.Currency,
                          t.LogoReference,
                          c.PublicBookingEnabled,
                          c.PublicBookingHorizonDays,
                          c.PublicPriceVisibility
                      )).FirstOrDefaultAsync(token);
    }

    public async Task<Guid?> FindTenantIdBySlugAsync(string slug, CancellationToken token)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        return await context.Tenants.AsNoTracking().IgnoreQueryFilters()
            .Where(t => t.Slug == normalizedSlug && t.Status == TenantStatus.Active)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(token);
    }

    public async Task<IReadOnlyCollection<PublicDoctorDto>> GetEligibleDoctorsAsync(Guid tenantId, CancellationToken token)
    {
        return await (from doc in context.DoctorProfiles.AsNoTracking().IgnoreQueryFilters()
                      join u in context.ClinicUsers.AsNoTracking().IgnoreQueryFilters() on doc.ClinicUserId equals u.Id
                      where doc.TenantId == tenantId && doc.Status == DoctorProfileStatus.Active && doc.IsPublicBookingEnabled
                      select new PublicDoctorDto(
                          doc.Id,
                          u.DisplayName,
                          doc.Specialization,
                          doc.Bio,
                          doc.ConsultationDurationMinutes
                      )).ToListAsync(token);
    }

    public async Task<DoctorProfile?> FindDoctorAsync(Guid tenantId, Guid doctorProfileId, CancellationToken token)
    {
        return await context.DoctorProfiles.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == doctorProfileId, token);
    }

    public async Task<IReadOnlyCollection<DoctorSchedule>> GetDoctorScheduleAsync(Guid doctorProfileId, CancellationToken token)
    {
        return await context.DoctorSchedules.AsNoTracking().IgnoreQueryFilters()
            .Include(x => x.Breaks)
            .Where(x => x.DoctorProfileId == doctorProfileId)
            .ToListAsync(token);
    }

    public async Task<IReadOnlyCollection<AppointmentBusyPeriod>> GetBusyPeriodsAsync(
        Guid doctorProfileId, DateTimeOffset rangeStart, DateTimeOffset rangeEnd, CancellationToken token)
    {
        return await context.Appointments.AsNoTracking().IgnoreQueryFilters()
            .Where(x => x.DoctorProfileId == doctorProfileId && x.Status != AppointmentStatus.Cancelled &&
                        x.StartAt < rangeEnd && x.EndAt > rangeStart)
            .Select(x => new AppointmentBusyPeriod(x.StartAt, x.EndAt))
            .ToListAsync(token);
    }

    public async Task<DoctorScheduleBreak[]> GetDoctorScheduleBreaksAsync(Guid doctorProfileId, CancellationToken token)
    {
        return await (from b in context.DoctorScheduleBreaks.AsNoTracking().IgnoreQueryFilters()
                      join s in context.DoctorSchedules.AsNoTracking().IgnoreQueryFilters() on b.DoctorScheduleId equals s.Id
                      where s.DoctorProfileId == doctorProfileId
                      select b).ToArrayAsync(token);
    }

    public async Task<IReadOnlyCollection<PublicServiceDto>> GetEligibleServicesAsync(Guid tenantId, bool priceVisibility, CancellationToken token)
    {
        return await context.TreatmentCatalogItems.AsNoTracking().IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId && s.IsActive && s.IsPublicBookingEnabled)
            .Select(s => new PublicServiceDto(
                s.Id,
                s.Name,
                s.Code,
                s.Description,
                s.DurationMinutes,
                priceVisibility ? s.DefaultPrice : null
            )).ToListAsync(token);
    }

    public async Task<TreatmentCatalogItem?> FindServiceAsync(Guid tenantId, Guid serviceId, CancellationToken token)
    {
        return await context.TreatmentCatalogItems.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Id == serviceId, token);
    }

    public async Task<Patient?> FindPatientByNormalizedPhoneAsync(Guid tenantId, string normalizedPhone, CancellationToken token)
    {
        return await context.Patients.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Phone == normalizedPhone && p.Status == PatientStatus.Active, token);
    }

    public async Task AddPatientAsync(Patient patient, CancellationToken token)
    {
        await context.Patients.AddAsync(patient, token);
    }

    public async Task AddAppointmentAsync(Appointment appointment, CancellationToken token)
    {
        await context.Appointments.AddAsync(appointment, token);
    }

    public async Task<PublicBookingIdempotencyRecord?> FindIdempotencyRecordAsync(Guid tenantId, string idempotencyKey, CancellationToken token)
    {
        return await context.PublicBookingIdempotencyRecords.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == idempotencyKey, token);
    }

    public async Task AddIdempotencyRecordAsync(PublicBookingIdempotencyRecord record, CancellationToken token)
    {
        await context.PublicBookingIdempotencyRecords.AddAsync(record, token);
    }

    public async Task<Appointment?> FindBookingByReferenceAsync(string reference, CancellationToken token)
    {
        return await context.Appointments.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.BookingReference == reference, token);
    }

    public async Task<PublicBookingConfirmationDto?> GetBookingConfirmationAsync(string reference, CancellationToken token)
    {
        return await (from appt in context.Appointments.AsNoTracking().IgnoreQueryFilters()
                      join tenant in context.Tenants.AsNoTracking().IgnoreQueryFilters() on appt.TenantId equals tenant.Id
                      join config in context.TenantConfigurations.AsNoTracking().IgnoreQueryFilters() on tenant.Id equals config.TenantId
                      join doc in context.DoctorProfiles.AsNoTracking().IgnoreQueryFilters() on appt.DoctorProfileId equals doc.Id
                      join docUser in context.ClinicUsers.AsNoTracking().IgnoreQueryFilters() on doc.ClinicUserId equals docUser.Id
                      join patient in context.Patients.AsNoTracking().IgnoreQueryFilters() on appt.PatientId equals patient.Id
                      join svc in context.TreatmentCatalogItems.AsNoTracking().IgnoreQueryFilters() on appt.TreatmentCatalogItemId equals svc.Id into svcs
                      from svc in svcs.DefaultIfEmpty()
                      where appt.BookingReference == reference
                      select new PublicBookingConfirmationDto(
                          appt.BookingReference!,
                          tenant.Name,
                          docUser.DisplayName,
                          svc != null ? svc.Name : "Dental Consultation",
                          appt.StartAt,
                          appt.EndAt,
                          config.TimeZone,
                          $"{patient.FirstName} {patient.LastName}".Trim(),
                          patient.Phone,
                          appt.Status.ToString()
                      )).FirstOrDefaultAsync(token);
    }

    public async Task<string> GetNextPatientNumberAsync(Guid tenantId, CancellationToken token)
    {
        const string sql = """
            WITH tenant_prefix AS (
                SELECT UPPER(LEFT(REGEXP_REPLACE("Slug", '[^a-zA-Z0-9]', '', 'g'), 3)) AS prefix
                FROM tenants
                WHERE "Id" = @tenant_id
            )
            INSERT INTO patient_number_sequences ("Id", "TenantId", "Prefix", "LastValue")
            SELECT gen_random_uuid(), @tenant_id, prefix, 1
            FROM tenant_prefix
            ON CONFLICT ("TenantId") DO UPDATE
                SET "LastValue" = patient_number_sequences."LastValue" + 1
            RETURNING "Prefix", "LastValue";
            """;

        var connection = context.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(token);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.Parameters.Add(new Npgsql.NpgsqlParameter<Guid>("tenant_id", tenantId));

        await using var reader = await command.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token))
        {
            return $"PAT-{Random.Shared.Next(100000, 999999)}";
        }

        var prefix = reader.GetString(0);
        var value = reader.GetInt64(1);
        return $"{prefix}-{value:000000}";
    }

    public async Task CommitTransactionAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }
}
