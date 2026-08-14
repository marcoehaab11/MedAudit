using System.Data;
using System.Data.Common;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

internal sealed class PatientStore(ApplicationDbContext context) : IPatientStore
{
    public async Task<IPatientTransaction> BeginTransactionAsync(CancellationToken cancellationToken) =>
        new PatientTransaction(await context.Database.BeginTransactionAsync(cancellationToken));

    public async Task<string> ReservePatientNumberAsync(Guid tenantId, CancellationToken cancellationToken)
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
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.Parameters.Add(new NpgsqlParameter<Guid>("tenant_id", tenantId));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("The tenant could not be found while reserving a patient number.");
        }

        var prefix = reader.GetString(0);
        var value = reader.GetInt64(1);
        return $"{prefix}-{value:000000}";
    }

    public async Task<PagedResult<PatientListItem>> SearchAsync(
        PatientSearchQuery query,
        CancellationToken cancellationToken)
    {
        var patients = context.Patients.AsNoTracking();
        if (query.Status is not null)
        {
            patients = patients.Where(x => x.Status == query.Status);
        }

        if (query.Gender is not null)
        {
            patients = patients.Where(x => x.Gender == query.Gender);
        }

        if (query.RegisteredFrom is not null)
        {
            var from = new DateTimeOffset(query.RegisteredFrom.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            patients = patients.Where(x => x.CreatedAt >= from);
        }

        if (query.RegisteredTo is not null)
        {
            var through = new DateTimeOffset(
                query.RegisteredTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            patients = patients.Where(x => x.CreatedAt < through);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = $"%{query.Search.Trim()}%";
            patients = patients.Where(x =>
                EF.Functions.ILike(x.PatientNumber, term) ||
                EF.Functions.ILike(x.FirstName, term) ||
                EF.Functions.ILike(x.LastName, term) ||
                (x.MiddleName != null && EF.Functions.ILike(x.MiddleName, term)) ||
                EF.Functions.ILike(x.FirstName + " " + x.LastName, term) ||
                EF.Functions.ILike(x.Phone, term) ||
                (x.Email != null && EF.Functions.ILike(x.Email, term)));
        }

        var total = await patients.CountAsync(cancellationToken);
        patients = (query.SortBy, query.Descending) switch
        {
            (PatientSortField.Name, false) => patients.OrderBy(x => x.LastName).ThenBy(x => x.FirstName),
            (PatientSortField.Name, true) => patients.OrderByDescending(x => x.LastName).ThenByDescending(x => x.FirstName),
            (PatientSortField.PatientNumber, false) => patients.OrderBy(x => x.PatientNumber),
            (PatientSortField.PatientNumber, true) => patients.OrderByDescending(x => x.PatientNumber),
            (_, false) => patients.OrderBy(x => x.CreatedAt),
            _ => patients.OrderByDescending(x => x.CreatedAt)
        };

        var items = await patients
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new PatientListItem(
                x.Id,
                x.PatientNumber,
                x.FirstName + (x.MiddleName == null ? " " : " " + x.MiddleName + " ") + x.LastName,
                x.Gender,
                x.Phone,
                x.Email,
                x.Status,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return new PagedResult<PatientListItem>(items, query.Page, query.PageSize, total);
    }

    public async Task<PatientDetails?> GetDetailsAsync(
        Guid patientId,
        bool includeMedicalInformation,
        bool canEditMedicalInformation,
        CancellationToken cancellationToken)
    {
        var patient = await context.Patients.AsNoTracking().SingleOrDefaultAsync(x => x.Id == patientId, cancellationToken);
        if (patient is null)
        {
            return null;
        }

        var allergies = Array.Empty<MedicalTextItem>();
        var conditions = Array.Empty<MedicalTextItem>();
        var medications = Array.Empty<MedicationItem>();
        var surgeries = Array.Empty<SurgeryItem>();
        if (includeMedicalInformation)
        {
            allergies = await context.PatientAllergies.AsNoTracking()
                .Where(x => x.PatientId == patientId).OrderBy(x => x.Name)
                .Select(x => new MedicalTextItem(x.Id, x.Name, x.Notes, x.CreatedAt, x.UpdatedAt))
                .ToArrayAsync(cancellationToken);
            conditions = await context.PatientMedicalConditions.AsNoTracking()
                .Where(x => x.PatientId == patientId).OrderBy(x => x.Name)
                .Select(x => new MedicalTextItem(x.Id, x.Name, x.Notes, x.CreatedAt, x.UpdatedAt))
                .ToArrayAsync(cancellationToken);
            medications = await context.PatientMedications.AsNoTracking()
                .Where(x => x.PatientId == patientId).OrderBy(x => x.Name)
                .Select(x => new MedicationItem(x.Id, x.Name, x.Dosage, x.Notes, x.CreatedAt, x.UpdatedAt))
                .ToArrayAsync(cancellationToken);
            surgeries = await context.PatientSurgeries.AsNoTracking()
                .Where(x => x.PatientId == patientId).OrderByDescending(x => x.ProcedureDate)
                .Select(x => new SurgeryItem(x.Id, x.Procedure, x.ProcedureDate, x.Notes, x.CreatedAt, x.UpdatedAt))
                .ToArrayAsync(cancellationToken);
        }

        return new PatientDetails(
            patient.Id, patient.PatientNumber, patient.FirstName, patient.MiddleName, patient.LastName,
            patient.Gender, patient.DateOfBirth, patient.Phone, patient.AlternatePhone, patient.Email,
            patient.Address, patient.City, patient.Country, patient.EmergencyContactName,
            patient.EmergencyContactPhone, patient.Nationality, patient.Occupation, patient.MaritalStatus,
            patient.Notes, includeMedicalInformation ? patient.MedicalNotes : null, patient.Status,
            patient.CreatedAt, patient.UpdatedAt, includeMedicalInformation, canEditMedicalInformation,
            allergies, conditions, medications, surgeries);
    }

    public Task<Patient?> FindPatientAsync(Guid patientId, CancellationToken cancellationToken) =>
        context.Patients.SingleOrDefaultAsync(x => x.Id == patientId, cancellationToken);

    public Task<PatientAllergy?> FindAllergyAsync(Guid patientId, Guid allergyId, CancellationToken cancellationToken) =>
        context.PatientAllergies.SingleOrDefaultAsync(x => x.PatientId == patientId && x.Id == allergyId, cancellationToken);

    public Task<PatientMedicalCondition?> FindConditionAsync(Guid patientId, Guid conditionId, CancellationToken cancellationToken) =>
        context.PatientMedicalConditions.SingleOrDefaultAsync(x => x.PatientId == patientId && x.Id == conditionId, cancellationToken);

    public Task<PatientMedication?> FindMedicationAsync(Guid patientId, Guid medicationId, CancellationToken cancellationToken) =>
        context.PatientMedications.SingleOrDefaultAsync(x => x.PatientId == patientId && x.Id == medicationId, cancellationToken);

    public Task<PatientSurgery?> FindSurgeryAsync(Guid patientId, Guid surgeryId, CancellationToken cancellationToken) =>
        context.PatientSurgeries.SingleOrDefaultAsync(x => x.PatientId == patientId && x.Id == surgeryId, cancellationToken);

    public void AddPatient(Patient patient) => context.Patients.Add(patient);
    public void AddAllergy(PatientAllergy allergy) => context.PatientAllergies.Add(allergy);
    public void AddCondition(PatientMedicalCondition condition) => context.PatientMedicalConditions.Add(condition);
    public void AddMedication(PatientMedication medication) => context.PatientMedications.Add(medication);
    public void AddSurgery(PatientSurgery surgery) => context.PatientSurgeries.Add(surgery);
    public void RemoveAllergy(PatientAllergy allergy) => context.PatientAllergies.Remove(allergy);
    public void RemoveCondition(PatientMedicalCondition condition) => context.PatientMedicalConditions.Remove(condition);
    public void RemoveMedication(PatientMedication medication) => context.PatientMedications.Remove(medication);
    public void RemoveSurgery(PatientSurgery surgery) => context.PatientSurgeries.Remove(surgery);
    public void AddAudit(PlatformAuditLog audit) => context.PlatformAuditLogs.Add(audit);
    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
