using System.Data;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Prescriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PrescriptionStore(ApplicationDbContext context) : IPrescriptionStore
{
    public async Task<IPrescriptionTransaction> BeginTransactionAsync(CancellationToken token) => new Transaction(await context.Database.BeginTransactionAsync(token));
    public async Task<string> ReserveNumberAsync(Guid tenantId, CancellationToken token)
    {
        const string sql = """
            INSERT INTO prescription_number_sequences ("Id", "TenantId", "LastValue") VALUES (gen_random_uuid(), @tenant_id, 1)
            ON CONFLICT ("TenantId") DO UPDATE SET "LastValue" = prescription_number_sequences."LastValue" + 1
            RETURNING "LastValue";
            """;
        var connection = context.Database.GetDbConnection(); if (connection.State != ConnectionState.Open) await connection.OpenAsync(token);
        await using var command = connection.CreateCommand(); command.CommandText = sql; command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.Parameters.Add(new NpgsqlParameter<Guid>("tenant_id", tenantId)); var value = (long)(await command.ExecuteScalarAsync(token) ?? throw new InvalidOperationException("Prescription number could not be reserved."));
        return $"RX-{value:000000}";
    }
    public Task<PrescriptionPatient?> FindPatientAsync(Guid id, CancellationToken token) => context.Patients.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new PrescriptionPatient(x.Id, x.FirstName + " " + x.LastName, x.Status == PatientStatus.Active)).SingleOrDefaultAsync(token);
    public Task<PrescriptionDoctor?> FindDoctorAsync(Guid id, CancellationToken token) => context.DoctorProfiles.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new PrescriptionDoctor(x.Id, x.ClinicUserId, context.ClinicUsers.Where(u => u.Id == x.ClinicUserId).Select(u => u.DisplayName).Single(), x.Specialization, x.LicenseNumber, x.Status == DoctorProfileStatus.Active)).SingleOrDefaultAsync(token);
    public Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken token) => context.DoctorProfiles.AsNoTracking().Where(x => x.ClinicUserId == userId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(token);
    public Task<PrescriptionAssociation?> FindAppointmentAsync(Guid id, CancellationToken token) => context.Appointments.AsNoTracking().Where(x => x.Id == id).Select(x => new PrescriptionAssociation(x.Id, x.PatientId, x.DoctorProfileId)).SingleOrDefaultAsync(token);
    public Task<PrescriptionAssociation?> FindExaminationAsync(Guid id, CancellationToken token) => context.Examinations.AsNoTracking().Where(x => x.Id == id)
        .Select(x => new PrescriptionAssociation(x.Id, x.PatientId, context.DoctorProfiles.Where(d => d.ClinicUserId == x.DoctorUserId).Select(d => d.Id).Single())).SingleOrDefaultAsync(token);
    public Task<PrescriptionAssociation?> FindTreatmentAsync(Guid id, CancellationToken token) => context.Treatments.AsNoTracking().Where(x => x.Id == id).Select(x => new PrescriptionAssociation(x.Id, x.PatientId, x.DoctorProfileId)).SingleOrDefaultAsync(token);
    public Task<MedicationCatalogItem?> FindMedicationAsync(Guid id, bool tracking, CancellationToken token) => (tracking ? context.MedicationCatalogItems.AsQueryable() : context.MedicationCatalogItems.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public async Task<PagedResult<MedicationCatalogDetails>> SearchMedicationsAsync(MedicationSearch request, CancellationToken token)
    {
        var query = context.MedicationCatalogItems.AsNoTracking().Where(x => request.IncludeInactive || x.IsActive);
        if (request.Form.HasValue) query = query.Where(x => x.Form == request.Form);
        if (!string.IsNullOrWhiteSpace(request.Search)) { var term = $"%{request.Search.Trim()}%"; query = query.Where(x => EF.Functions.ILike(x.Name, term) || (x.GenericName != null && EF.Functions.ILike(x.GenericName, term)) || (x.Strength != null && EF.Functions.ILike(x.Strength, term))); }
        var total = await query.CountAsync(token); var items = await query.OrderBy(x => x.Name).Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(x => new MedicationCatalogDetails(x.Id, x.Name, x.GenericName, x.Strength, x.Form, x.IsActive)).ToListAsync(token); return new(items, request.Page, request.PageSize, total);
    }
    public Task<Prescription?> FindPrescriptionAsync(Guid id, bool tracking, CancellationToken token)
    { var query = tracking ? context.Prescriptions.AsQueryable() : context.Prescriptions.AsNoTracking(); return query.Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id, token); }
    public async Task<PrescriptionDetails?> GetPrescriptionAsync(Guid id, Guid? visibleDoctorId, CancellationToken token)
    {
        var item = await context.Prescriptions.AsNoTracking().Include(x => x.Items).SingleOrDefaultAsync(x => x.Id == id && (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId), token); if (item is null) return null;
        var patient = await context.Patients.Where(x => x.Id == item.PatientId).Select(x => x.FirstName + " " + x.LastName).SingleAsync(token);
        var doctor = await DoctorName(item.DoctorProfileId).SingleAsync(token);
        return new(item.Id, item.PrescriptionNumber, item.PatientId, patient, item.DoctorProfileId, doctor, item.AppointmentId, item.ExaminationId, item.TreatmentId, item.Status, item.Notes,
            item.CreatedAt, item.UpdatedAt, item.IssuedAt, item.CancelledAt, item.DocumentReference, item.Version,
            item.Items.OrderBy(x => x.SortOrder).Select(x => new PrescriptionItemDetails(x.Id, x.MedicationId, x.MedicationNameSnapshot, x.GenericNameSnapshot, x.StrengthSnapshot, x.FormSnapshot, x.Dose, x.Frequency, x.Duration, x.Route, x.Instructions, x.Quantity, x.SortOrder)).ToArray());
    }
    public async Task<PagedResult<PrescriptionListItem>> SearchPrescriptionsAsync(PrescriptionSearch request, Guid? visibleDoctorId, CancellationToken token)
    {
        var query = context.Prescriptions.AsNoTracking().Where(x => (!visibleDoctorId.HasValue || x.DoctorProfileId == visibleDoctorId) && (!request.PatientId.HasValue || x.PatientId == request.PatientId) && (!request.DoctorProfileId.HasValue || x.DoctorProfileId == request.DoctorProfileId) && (!request.Status.HasValue || x.Status == request.Status));
        if (request.From.HasValue) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(request.From.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (request.To.HasValue) query = query.Where(x => x.CreatedAt < new DateTimeOffset(request.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var total = await query.CountAsync(token); var items = await query.OrderByDescending(x => x.CreatedAt).Skip((request.Page - 1) * request.PageSize).Take(request.PageSize)
            .Select(x => new PrescriptionListItem(x.Id, x.PrescriptionNumber, x.PatientId, context.Patients.Where(p => p.Id == x.PatientId).Select(p => p.FirstName + " " + p.LastName).Single(), x.DoctorProfileId,
                context.DoctorProfiles.Where(d => d.Id == x.DoctorProfileId).SelectMany(d => context.ClinicUsers.Where(u => u.Id == d.ClinicUserId).Select(u => u.DisplayName)).Single(), x.Status, x.CreatedAt, x.IssuedAt)).ToListAsync(token);
        return new(items, request.Page, request.PageSize, total);
    }
    public Task<PrescriptionClinic> GetClinicAsync(CancellationToken token) => context.Tenants.AsNoTracking().Where(x => context.Prescriptions.Any(p => p.TenantId == x.Id))
        .Select(x => new PrescriptionClinic(x.Name, x.LogoReference, x.Address, x.City, x.Country, x.Phone)).SingleAsync(token);
    public void AddMedication(MedicationCatalogItem item) => context.MedicationCatalogItems.Add(item);
    public void AddPrescription(Prescription prescription) => context.Prescriptions.Add(prescription);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public async Task SaveChangesAsync(CancellationToken token)
    { try { await context.SaveChangesAsync(token); } catch (DbUpdateConcurrencyException) { throw new PrescriptionConcurrencyException("The prescription changed. Reload it before continuing."); } catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg && pg.SqlState is PostgresErrorCodes.UniqueViolation or PostgresErrorCodes.CheckViolation) { throw new PrescriptionConcurrencyException("The prescription conflicts with persisted clinical data."); } }
    private IQueryable<string> DoctorName(Guid id) => context.DoctorProfiles.AsNoTracking().Where(x => x.Id == id).SelectMany(x => context.ClinicUsers.Where(u => u.Id == x.ClinicUserId).Select(u => u.DisplayName));
    private sealed class Transaction(IDbContextTransaction inner) : IPrescriptionTransaction { public Task CommitAsync(CancellationToken token) => inner.CommitAsync(token); public ValueTask DisposeAsync() => inner.DisposeAsync(); }
}
