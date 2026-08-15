using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Dental;

internal sealed class DentalQueries(IDentalStore store, IPermissionService permissions, ICurrentUser currentUser) : IDentalQueries
{
    public async Task<PatientDentalChart?> GetChartAsync(Guid patientId, CancellationToken cancellationToken)
    { await permissions.EnsurePermissionAsync(Permissions.DentalView, cancellationToken); return await store.GetChartAsync(patientId, cancellationToken); }
    public async Task<IReadOnlyCollection<ExaminationHistoryItem>> GetHistoryAsync(Guid patientId, int take, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DentalHistoryView, cancellationToken);
        if (take is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(take));
        return await store.GetHistoryAsync(patientId, take, cancellationToken);
    }
    public async Task<ExaminationDetails?> GetExaminationAsync(Guid id, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.ExaminationView, cancellationToken);
        var item = await store.GetExaminationAsync(id, cancellationToken); if (item is null) return null;
        var elevated = await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, cancellationToken);
        if (!elevated && item.DoctorUserId != currentUser.UserId) return null;
        var canEdit = item.Status == ExaminationStatus.Draft &&
            await permissions.HasPermissionAsync(Permissions.ExaminationEdit, cancellationToken) &&
            await permissions.HasPermissionAsync(Permissions.DentalEdit, cancellationToken);
        var canComplete = item.Status == ExaminationStatus.Draft &&
            await permissions.HasPermissionAsync(Permissions.ExaminationComplete, cancellationToken);
        return item with { CanEdit = canEdit, CanComplete = canComplete };
    }
    public async Task<ExaminationDetails?> GetByAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.ExaminationView, cancellationToken);
        var id = await store.FindExaminationIdByAppointmentAsync(appointmentId, cancellationToken);
        return id.HasValue ? await GetExaminationAsync(id.Value, cancellationToken) : null;
    }
}

internal sealed class ExaminationCommands(
    IDentalStore store, IPermissionService permissions, ICurrentTenant tenant,
    ICurrentUser currentUser, ISystemClock clock) : IExaminationCommands
{
    public async Task<Guid> CreateAsync(Guid appointmentId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.ExaminationCreate, cancellationToken);
        var actor = Actor();
        var appointment = await store.FindAppointmentAsync(appointmentId, cancellationToken)
            ?? throw new DentalNotFoundException("Appointment was not found.");
        await EnsureAppointmentVisibleAsync(appointment, cancellationToken);
        if (appointment.Status != AppointmentStatus.InProgress)
            throw new DentalStateException("An examination can only be opened for an appointment in progress.");
        var patient = await store.FindPatientAsync(appointment.PatientId, cancellationToken);
        if (patient is null || !patient.IsActive) throw new DentalNotFoundException("An active patient was not found.");
        if (await store.ExaminationExistsForAppointmentAsync(appointmentId, cancellationToken))
            throw new DentalConcurrencyException("An examination already exists for this appointment.");
        var examination = new Examination(tenant.RequireTenantId(), appointment.PatientId, appointment.Id,
            appointment.DoctorUserId, actor, clock.UtcNow);
        store.Add(examination); Audit(PlatformAuditAction.ExaminationCreated, examination.Id);
        await store.SaveChangesAsync(cancellationToken); return examination.Id;
    }

    public Task<bool> UpdateNotesAsync(Guid id, string? notes, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.ExaminationEdit, (e, now) => { e.UpdateNotes(notes, version, now); return null; }, PlatformAuditAction.ExaminationNotesUpdated, token);
    public Task<bool> AddFindingAsync(Guid id, DentalRecordInput<DentalFindingType> input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => e.AddFinding(input.ToothNumber, input.Type, input.Surfaces, input.Notes, Actor(), version, now).Id, PlatformAuditAction.FindingAdded, token);
    public Task<bool> UpdateFindingAsync(Guid id, Guid itemId, DentalRecordInput<DentalFindingType> input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.UpdateFinding(itemId, input.Type, input.Surfaces, input.Notes, version, now); return null; }, PlatformAuditAction.FindingUpdated, token, itemId);
    public Task<bool> RemoveFindingAsync(Guid id, Guid itemId, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.RemoveFinding(itemId, version, now); return null; }, PlatformAuditAction.FindingRemoved, token, itemId);
    public Task<bool> AddProcedureAsync(Guid id, DentalRecordInput<DentalProcedureType> input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => e.AddProcedure(input.ToothNumber, input.Type, input.Surfaces, input.Notes, Actor(), version, now).Id, PlatformAuditAction.ProcedureAdded, token);
    public Task<bool> UpdateProcedureAsync(Guid id, Guid itemId, DentalRecordInput<DentalProcedureType> input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.UpdateProcedure(itemId, input.Type, input.Surfaces, input.Notes, version, now); return null; }, PlatformAuditAction.ProcedureUpdated, token, itemId);
    public Task<bool> RemoveProcedureAsync(Guid id, Guid itemId, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.RemoveProcedure(itemId, version, now); return null; }, PlatformAuditAction.ProcedureRemoved, token, itemId);
    public Task<bool> AddEndodonticAsync(Guid id, EndodonticInput input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => e.AddEndodonticRecord(input.ToothNumber, input.Notes, input.Canals, Actor(), version, now).Id, PlatformAuditAction.EndodonticRecordCreated, token);
    public Task<bool> UpdateEndodonticAsync(Guid id, Guid itemId, EndodonticInput input, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.UpdateEndodonticRecord(itemId, input.Notes, input.Canals, version, now); return null; }, PlatformAuditAction.EndodonticRecordUpdated, token, itemId);
    public Task<bool> RemoveEndodonticAsync(Guid id, Guid itemId, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.DentalEdit, (e, now) => { e.RemoveEndodonticRecord(itemId, version, now); return null; }, PlatformAuditAction.EndodonticRecordRemoved, token, itemId);
    public Task<bool> CompleteAsync(Guid id, Guid version, CancellationToken token) =>
        MutateAsync(id, Permissions.ExaminationComplete, (e, now) => { e.Complete(version, now); return null; }, PlatformAuditAction.ExaminationCompleted, token);

    private async Task<bool> MutateAsync(Guid id, string permission, Func<Examination, DateTimeOffset, Guid?> mutation,
        PlatformAuditAction? action, CancellationToken cancellationToken, Guid? auditEntityId = null)
    {
        await permissions.EnsurePermissionAsync(permission, cancellationToken);
        if (permission == Permissions.DentalEdit)
            await permissions.EnsurePermissionAsync(Permissions.ExaminationEdit, cancellationToken);
        var examination = await store.FindExaminationAsync(id, true, cancellationToken);
        if (examination is null) return false;
        await EnsureExaminationVisibleAsync(examination, cancellationToken);
        var changedEntityId = mutation(examination, clock.UtcNow);
        if (action.HasValue) Audit(action.Value, auditEntityId ?? changedEntityId ?? examination.Id);
        await store.SaveChangesAsync(cancellationToken); return true;
    }

    private async Task EnsureAppointmentVisibleAsync(ClinicalAppointment appointment, CancellationToken cancellationToken)
    {
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, cancellationToken)) return;
        var doctor = await store.FindDoctorProfileIdForUserAsync(Actor(), cancellationToken);
        if (doctor != appointment.DoctorProfileId) throw new ForbiddenAccessException("Doctors may only access their own clinical appointments.");
    }
    private async Task EnsureExaminationVisibleAsync(Examination examination, CancellationToken cancellationToken)
    {
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, cancellationToken)) return;
        if (examination.DoctorUserId != Actor()) throw new ForbiddenAccessException("Doctors may only edit their own examinations.");
    }
    private Guid Actor() => currentUser.UserId ?? throw new ForbiddenAccessException("An authenticated clinic user is required.");
    private void Audit(PlatformAuditAction action, Guid entityId) => store.AddAudit(new PlatformAuditLog(
        tenant.RequireTenantId(), currentUser.UserId, action, "DentalClinicalRecord", entityId, clock.UtcNow, null));
}
