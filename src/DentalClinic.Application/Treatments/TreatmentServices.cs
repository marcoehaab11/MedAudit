using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Treatments;

internal sealed class TreatmentCatalogService(ITreatmentStore store, IPermissionService permissions,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : ITreatmentCatalogService
{
    public async Task<IReadOnlyCollection<CatalogItemDetails>> ListAsync(bool includeInactive, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.TreatmentCatalogView, token); return await store.GetCatalogAsync(includeInactive, token); }
    public async Task<Guid> CreateAsync(CatalogItemInput input, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.TreatmentCatalogManage, token);
        if (string.IsNullOrWhiteSpace(input.Code)) throw new ArgumentException("Treatment code is required.");
        if (await store.CatalogCodeExistsAsync(input.Code.Trim().ToUpperInvariant(), null, token)) throw new ArgumentException("Treatment code already exists.");
        var item = new TreatmentCatalogItem(tenant.RequireTenantId(), input.Type, input.Name, input.Code, input.Description, input.DefaultPrice, clock.UtcNow);
        store.AddCatalog(item); Audit(PlatformAuditAction.TreatmentCatalogCreated, item.Id); await store.SaveChangesAsync(token); return item.Id;
    }
    public async Task<bool> UpdateAsync(Guid id, CatalogItemInput input, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.TreatmentCatalogManage, token);
        var item = await store.FindCatalogAsync(id, true, token); if (item is null) return false;
        if (string.IsNullOrWhiteSpace(input.Code)) throw new ArgumentException("Treatment code is required.");
        if (await store.CatalogCodeExistsAsync(input.Code.Trim().ToUpperInvariant(), id, token)) throw new ArgumentException("Treatment code already exists.");
        item.Update(input.Type, input.Name, input.Code, input.Description, input.DefaultPrice, input.IsActive, clock.UtcNow);
        Audit(PlatformAuditAction.TreatmentCatalogUpdated, item.Id); await store.SaveChangesAsync(token); return true;
    }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, "TreatmentCatalogItem", id, clock.UtcNow, null));
}

internal sealed class TreatmentPlanService(ITreatmentStore store, TreatmentAccess access, IPermissionService permissions,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : ITreatmentPlanService
{
    public async Task<PagedResult<TreatmentPlanListItem>> SearchAsync(TreatmentPlanSearch query, CancellationToken token)
    { Validate(query.Page, query.PageSize, query.From, query.To); if (query.Status.HasValue && !Enum.IsDefined(query.Status.Value)) throw new ArgumentException("Invalid treatment plan status."); return await store.SearchPlansAsync(query, await access.VisibleDoctorAsync(Permissions.TreatmentPlansView, token), token); }
    public async Task<TreatmentPlanDetails?> GetAsync(Guid id, CancellationToken token) =>
        await store.GetPlanAsync(id, await access.VisibleDoctorAsync(Permissions.TreatmentPlansView, token), token);
    public async Task<Guid> CreateAsync(CreateTreatmentPlanCommand command, CancellationToken token)
    {
        await access.EnsureDoctorAsync(command.DoctorProfileId, Permissions.TreatmentPlansCreate, token);
        var patient = await store.FindPatientAsync(command.PatientId, token); var doctor = await store.FindDoctorAsync(command.DoctorProfileId, token);
        if (patient is null || !patient.IsActive || doctor is null || !doctor.IsActive) throw new TreatmentNotFoundException("An active patient and doctor are required.");
        if (command.Items.Count == 0) throw new ArgumentException("At least one treatment plan item is required.");
        var plan = new TreatmentPlan(tenant.RequireTenantId(), command.PatientId, command.DoctorProfileId, command.Title, command.Notes, 0, clock.UtcNow);
        foreach (var input in command.Items) await AddNewItemAsync(plan, input, token);
        plan.Update(command.Title, command.Notes, command.DiscountAmount, plan.Version, clock.UtcNow);
        store.AddPlan(plan); Audit(PlatformAuditAction.TreatmentPlanCreated, plan.Id); await store.SaveChangesAsync(token); return plan.Id;
    }
    public async Task<bool> UpdateAsync(UpdateTreatmentPlanCommand command, CancellationToken token) =>
        await MutateAsync(command.Id, Permissions.TreatmentPlansEdit,
            p => p.Update(command.Title, command.Notes, command.DiscountAmount, command.Version, clock.UtcNow), PlatformAuditAction.TreatmentPlanUpdated, token);
    public async Task<bool> AddItemAsync(Guid planId, PlanItemInput input, Guid version, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.TreatmentPlansEdit, token); var plan = await FindForWriteAsync(planId, token); if (plan is null) return false;
        if (plan.Version != version) throw new TreatmentConcurrencyException("The treatment plan changed. Reload it before continuing.");
        var item = await AddNewItemAsync(plan, input, token); Audit(PlatformAuditAction.TreatmentPlanUpdated, item.Id); await store.SaveChangesAsync(token); return true;
    }
    public Task<bool> UpdateItemAsync(UpdatePlanItemCommand c, CancellationToken token) => MutateAsync(c.PlanId, Permissions.TreatmentPlansEdit,
        p => p.UpdateItem(c.ItemId, c.ToothNumber, c.Quantity, c.DiscountAmount, c.Notes, c.Version, clock.UtcNow), PlatformAuditAction.TreatmentPlanUpdated, token, c.ItemId);
    public Task<bool> RemoveItemAsync(Guid planId, Guid itemId, Guid version, CancellationToken token) => MutateAsync(planId, Permissions.TreatmentPlansEdit,
        p => p.RemoveItem(itemId, version, clock.UtcNow), PlatformAuditAction.TreatmentPlanUpdated, token, itemId);
    public async Task<bool> TransitionAsync(Guid id, string action, Guid version, CancellationToken token)
    {
        var permission = action switch
        {
            "propose" => Permissions.TreatmentPlansPropose,
            "accept" => Permissions.TreatmentPlansAccept,
            "reject" => Permissions.TreatmentPlansReject,
            "cancel" => Permissions.TreatmentPlansCancel,
            "start" or "complete" => Permissions.TreatmentPlansEdit,
            _ => throw new ArgumentException("Unknown treatment plan action.")
        };
        var audit = action switch
        {
            "propose" => PlatformAuditAction.TreatmentPlanProposed,
            "accept" => PlatformAuditAction.TreatmentPlanAccepted,
            "reject" => PlatformAuditAction.TreatmentPlanRejected,
            "cancel" => PlatformAuditAction.TreatmentPlanCancelled,
            _ => PlatformAuditAction.TreatmentPlanUpdated
        };
        return await MutateAsync(id, permission, p => { if (action == "propose") p.Propose(version, clock.UtcNow); else if (action == "accept") p.Accept(version, clock.UtcNow); else if (action == "reject") p.Reject(version, clock.UtcNow); else if (action == "cancel") p.Cancel(version, clock.UtcNow); else if (action == "start") p.Start(version, clock.UtcNow); else p.Complete(version, clock.UtcNow); }, audit, token);
    }
    private async Task<TreatmentPlanItem> AddNewItemAsync(TreatmentPlan plan, PlanItemInput input, CancellationToken token)
    { var catalog = await store.FindCatalogAsync(input.CatalogItemId, false, token); if (catalog is null || !catalog.IsActive) throw new TreatmentNotFoundException("An active catalog item is required."); return plan.AddItem(catalog.Id, catalog.Type, catalog.Name, input.ToothNumber, input.Quantity, catalog.DefaultPrice, input.DiscountAmount, input.Notes, plan.Version, clock.UtcNow); }
    private async Task<TreatmentPlan?> FindForWriteAsync(Guid id, CancellationToken token)
    { var plan = await store.FindPlanAsync(id, true, token); if (plan is not null) await access.EnsureDoctorAsync(plan.DoctorProfileId, Permissions.TreatmentPlansEdit, token); return plan; }
    private async Task<bool> MutateAsync(Guid id, string permission, Action<TreatmentPlan> mutation, PlatformAuditAction audit, CancellationToken token, Guid? entityId = null)
    { await permissions.EnsurePermissionAsync(permission, token); var plan = await store.FindPlanAsync(id, true, token); if (plan is null) return false; await access.EnsureDoctorAsync(plan.DoctorProfileId, permission, token); mutation(plan); Audit(audit, entityId ?? id); await store.SaveChangesAsync(token); return true; }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, "TreatmentPlan", id, clock.UtcNow, null));
    private static void Validate(int page, int pageSize, DateOnly? from, DateOnly? to)
    { if (page < 1 || pageSize is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(page)); if (from > to) throw new ArgumentException("From date cannot exceed to date."); }
}

internal sealed class TreatmentService(ITreatmentStore store, TreatmentAccess access, IPermissionService permissions,
    ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : ITreatmentService
{
    public async Task<PagedResult<TreatmentListItem>> SearchAsync(TreatmentSearch query, CancellationToken token)
    { if (query.Page < 1 || query.PageSize is < 1 or > 100 || query.From > query.To) throw new ArgumentException("Invalid treatment search."); if ((query.Type.HasValue && !Enum.IsDefined(query.Type.Value)) || (query.Status.HasValue && !Enum.IsDefined(query.Status.Value))) throw new ArgumentException("Invalid treatment filter."); if (query.ToothNumber.HasValue) DentalClinic.Domain.Dental.PermanentToothCatalog.Get(query.ToothNumber.Value); return await store.SearchTreatmentsAsync(query, await access.VisibleDoctorAsync(Permissions.TreatmentsView, token), token); }
    public async Task<TreatmentDetails?> GetAsync(Guid id, CancellationToken token) =>
        await store.GetTreatmentAsync(id, await access.VisibleDoctorAsync(Permissions.TreatmentsView, token), token);
    public async Task<Guid> CreateAsync(CreateTreatmentCommand command, CancellationToken token)
    {
        await access.EnsureDoctorAsync(command.DoctorProfileId, Permissions.TreatmentsCreate, token);
        var patient = await store.FindPatientAsync(command.PatientId, token); var doctor = await store.FindDoctorAsync(command.DoctorProfileId, token);
        var catalog = await store.FindCatalogAsync(command.CatalogItemId, false, token);
        if (patient is null || !patient.IsActive || doctor is null || !doctor.IsActive || catalog is null || !catalog.IsActive)
            throw new TreatmentNotFoundException("An active patient, doctor, and catalog item are required.");
        decimal price = catalog.DefaultPrice; Guid? planId = null; var teeth = command.ToothNumbers.ToList();
        if (command.TreatmentPlanItemId.HasValue)
        {
            var source = await store.FindPlanExecutionSourceAsync(command.TreatmentPlanItemId.Value, token) ?? throw new TreatmentNotFoundException("Treatment plan item was not found.");
            if (source.PatientId != command.PatientId || source.DoctorProfileId != command.DoctorProfileId || source.CatalogItemId != command.CatalogItemId || source.PlanStatus is not (TreatmentPlanStatus.Accepted or TreatmentPlanStatus.InProgress))
                throw new ArgumentException("Treatment plan item does not match this execution.");
            price = source.Price; planId = source.PlanId; if (teeth.Count == 0 && source.ToothNumber.HasValue) teeth.Add(source.ToothNumber.Value);
        }
        if (command.AppointmentId.HasValue)
        { var appointment = await store.FindAppointmentAsync(command.AppointmentId.Value, token); if (appointment is null || appointment.PatientId != command.PatientId || appointment.DoctorProfileId != command.DoctorProfileId) throw new ArgumentException("Appointment does not match treatment patient and doctor."); }
        if (command.SourceDentalProcedureId.HasValue)
        { var procedure = await store.FindDentalProcedureAsync(command.SourceDentalProcedureId.Value, token); if (procedure is null || procedure.PatientId != command.PatientId || (teeth.Count > 0 && !teeth.Contains(procedure.ToothNumber))) throw new ArgumentException("Dental procedure does not match treatment patient and tooth."); if (teeth.Count == 0) teeth.Add(procedure.ToothNumber); }
        var treatment = new Treatment(tenant.RequireTenantId(), command.PatientId, command.DoctorProfileId, command.AppointmentId,
            planId, command.TreatmentPlanItemId, catalog.Id, command.SourceDentalProcedureId, catalog.Type, catalog.Name, teeth, price, command.Notes, clock.UtcNow);
        store.AddTreatment(treatment); Audit(PlatformAuditAction.TreatmentCreated, treatment.Id); await store.SaveChangesAsync(token); return treatment.Id;
    }
    public async Task<bool> UpdateNotesAsync(Guid id, string? notes, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.TreatmentsEdit, token); var item = await store.FindTreatmentAsync(id, true, token); if (item is null) return false; await access.EnsureDoctorAsync(item.DoctorProfileId, Permissions.TreatmentsEdit, token); item.UpdateNotes(notes, version, clock.UtcNow); Audit(PlatformAuditAction.TreatmentUpdated, id); await store.SaveChangesAsync(token); return true; }
    public async Task<bool> TransitionAsync(Guid id, string action, Guid version, CancellationToken token)
    {
        var permission = action switch
        {
            "start" => Permissions.TreatmentsStart,
            "complete" => Permissions.TreatmentsComplete,
            "cancel" => Permissions.TreatmentsCancel,
            _ => throw new ArgumentException("Unknown treatment action.")
        };
        await permissions.EnsurePermissionAsync(permission, token); var item = await store.FindTreatmentAsync(id, true, token); if (item is null) return false;
        await access.EnsureDoctorAsync(item.DoctorProfileId, permission, token);
        var audit = action == "start" ? PlatformAuditAction.TreatmentStarted : action == "complete" ? PlatformAuditAction.TreatmentCompleted : PlatformAuditAction.TreatmentCancelled;
        if (action == "start") item.Start(version, clock.UtcNow); else if (action == "complete") item.Complete(version, clock.UtcNow); else item.Cancel(version, clock.UtcNow);
        Audit(audit, id); await store.SaveChangesAsync(token); return true;
    }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, "Treatment", id, clock.UtcNow, null));
}
