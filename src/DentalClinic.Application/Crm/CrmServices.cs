using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Platform;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Crm;

internal static class CrmRules
{
    public static ValidationException Error(string field, string message) => new([new ValidationFailure(field, message)]);
    public static TimeZoneInfo Zone(string id) { try { return TimeZoneInfo.FindSystemTimeZoneById(id); } catch (Exception x) when (x is TimeZoneNotFoundException or InvalidTimeZoneException) { throw Error("TimeZone", "The clinic timezone is invalid."); } }
    public static DateTimeOffset Utc(DateOnly date, TimeOnly time, TimeZoneInfo zone)
    { var local = date.ToDateTime(time, DateTimeKind.Unspecified); if (zone.IsInvalidTime(local)) throw Error("DueAt", "This local time does not exist in the clinic timezone."); if (zone.IsAmbiguousTime(local)) throw Error("DueAt", "This local time is ambiguous in the clinic timezone."); return new(TimeZoneInfo.ConvertTimeToUtc(local, zone), TimeSpan.Zero); }
}

internal sealed class FollowUpQueries(ICrmStore store, IPermissionService permissions, ISystemClock clock) : IFollowUpQueries
{
    public async Task<CrmDashboard> DashboardAsync(CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.CrmView, token); var zoneId = await store.GetTimeZoneAsync(token); var zone = CrmRules.Zone(zoneId);
        var localNow = TimeZoneInfo.ConvertTime(clock.UtcNow, zone); var date = DateOnly.FromDateTime(localNow.DateTime);
        var today = CrmRules.Utc(date, TimeOnly.MinValue, zone); var week = CrmRules.Utc(date.AddDays(-(((int)localNow.DayOfWeek + 6) % 7)), TimeOnly.MinValue, zone);
        return await store.GetDashboardAsync(today, CrmRules.Utc(date.AddDays(1), TimeOnly.MinValue, zone), week,
            CrmRules.Utc(new DateOnly(date.Year, date.Month, 1), TimeOnly.MinValue, zone), clock.UtcNow, zoneId, token);
    }
    public async Task<PagedResult<FollowUpListItem>> SearchAsync(FollowUpSearch x, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.CrmView, token); var zoneId = await store.GetTimeZoneAsync(token); var zone = CrmRules.Zone(zoneId);
        if (x.DueFrom > x.DueTo) throw CrmRules.Error("DueTo", "End date cannot precede start date.");
        var query = new FollowUpStoreSearch(x.Search?.Trim(), x.Status, x.Type, x.AssignedToUserId, x.PatientId,
            x.DueFrom.HasValue ? CrmRules.Utc(x.DueFrom.Value, TimeOnly.MinValue, zone) : null,
            x.DueTo.HasValue ? CrmRules.Utc(x.DueTo.Value.AddDays(1), TimeOnly.MinValue, zone) : null,
            x.Overdue, clock.UtcNow, zoneId, Enum.IsDefined(x.SortBy) ? x.SortBy : FollowUpSortField.DueAt,
            x.Descending, Math.Max(1, x.Page), Math.Clamp(x.PageSize, 1, 100));
        return await store.SearchFollowUpsAsync(query, token);
    }
    public async Task<FollowUpDetails?> GetAsync(Guid id, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.CrmView, token); var zone = await store.GetTimeZoneAsync(token); return await store.GetFollowUpAsync(id, clock.UtcNow, zone, token); }
    public async Task<CrmPatientLifecycle?> PatientSummaryAsync(Guid id, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.CrmView, token); var zone = await store.GetTimeZoneAsync(token); return await store.GetPatientSummaryAsync(id, clock.UtcNow.AddMonths(-1), clock.UtcNow, zone, token); }
    public async Task<IReadOnlyCollection<CrmUserOption>> AssignableUsersAsync(CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.CrmAssignFollowUp, token); return await store.GetAssignableUsersAsync(token); }
}

internal sealed class CreateFollowUp(ICrmStore store, IPermissionService permissions, ICurrentTenant tenant,
    ICurrentUser user, ISystemClock clock) : ICreateFollowUp, IFollowUpCreator
{
    public async Task<Guid> ExecuteAsync(FollowUpInput input, CancellationToken token)
    {
        var zone = CrmRules.Zone(await store.GetTimeZoneAsync(token));
        return await CreateAsync(new(input.PatientId, input.Type, CrmRules.Utc(input.DueDate, input.DueTime, zone), input.Title,
            input.AssignedToUserId, input.Notes, input.RelatedAppointmentId, input.RelatedTreatmentPlanId, input.RelatedTreatmentId, input.RelatedPrescriptionId), token);
    }
    public async Task<Guid> CreateAsync(FollowUpCreationRequest x, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.CrmCreateFollowUp, token); var actor = user.UserId ?? throw new ForbiddenAccessException("An authenticated user is required.");
        var assignee = x.AssignedToUserId ?? actor; await ValidateAsync(x.PatientId, assignee, x.RelatedAppointmentId, x.RelatedTreatmentPlanId, x.RelatedTreatmentId, x.RelatedPrescriptionId, token);
        var item = new FollowUp(tenant.RequireTenantId(), x.PatientId, assignee, actor, x.Type, x.DueAt, x.Title, x.Notes,
            x.RelatedAppointmentId, x.RelatedTreatmentPlanId, x.RelatedTreatmentId, x.RelatedPrescriptionId, clock.UtcNow);
        store.AddFollowUp(item); Audit(PlatformAuditAction.FollowUpCreated, item.Id); await store.SaveChangesAsync(token); return item.Id;
    }
    private async Task ValidateAsync(Guid patientId, Guid userId, Guid? appointmentId, Guid? planId, Guid? treatmentId, Guid? prescriptionId, CancellationToken token)
    {
        if (await store.FindPatientAsync(patientId, token) is not { Status: PatientStatus.Active }) throw new CrmNotFoundException("Patient is not available.");
        if (await store.FindUserAsync(userId, token) is not { IsActive: true }) throw new CrmNotFoundException("Assignee is not available.");
        var relations = new[] { appointmentId.HasValue ? await store.FindAppointmentAsync(appointmentId.Value, token) : null,
            planId.HasValue ? await store.FindTreatmentPlanAsync(planId.Value, token) : null,
            treatmentId.HasValue ? await store.FindTreatmentAsync(treatmentId.Value, token) : null,
            prescriptionId.HasValue ? await store.FindPrescriptionAsync(prescriptionId.Value, token) : null };
        if ((appointmentId.HasValue && relations[0] is null) || (planId.HasValue && relations[1] is null) ||
            (treatmentId.HasValue && relations[2] is null) || (prescriptionId.HasValue && relations[3] is null)) throw new CrmNotFoundException("Related clinical record is not available.");
        if (relations.Any(r => r is not null && r.PatientId != patientId)) throw CrmRules.Error("PatientId", "Related clinical records must belong to the selected patient.");
    }
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new(tenant.RequireTenantId(), user.UserId, action, nameof(FollowUp), id, clock.UtcNow, null));
}

internal sealed class UpdateFollowUp(ICrmStore store, IPermissionService permissions, ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : IUpdateFollowUp
{
    public async Task<bool> ExecuteAsync(UpdateFollowUpCommand c, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.CrmEditFollowUp, token); var item = await store.FindFollowUpAsync(c.Id, true, token); if (item is null) return false;
        var userCheck = await store.FindUserAsync(c.Input.AssignedToUserId, token); if (userCheck is not { IsActive: true }) throw new CrmNotFoundException("Assignee is not available.");
        if (item.PatientId != c.Input.PatientId) throw CrmRules.Error("PatientId", "A follow-up patient cannot be changed.");
        var relations = new[] { c.Input.RelatedAppointmentId.HasValue ? await store.FindAppointmentAsync(c.Input.RelatedAppointmentId.Value, token) : null,
            c.Input.RelatedTreatmentPlanId.HasValue ? await store.FindTreatmentPlanAsync(c.Input.RelatedTreatmentPlanId.Value, token) : null,
            c.Input.RelatedTreatmentId.HasValue ? await store.FindTreatmentAsync(c.Input.RelatedTreatmentId.Value, token) : null,
            c.Input.RelatedPrescriptionId.HasValue ? await store.FindPrescriptionAsync(c.Input.RelatedPrescriptionId.Value, token) : null };
        if ((c.Input.RelatedAppointmentId.HasValue && relations[0] is null) || (c.Input.RelatedTreatmentPlanId.HasValue && relations[1] is null) ||
            (c.Input.RelatedTreatmentId.HasValue && relations[2] is null) || (c.Input.RelatedPrescriptionId.HasValue && relations[3] is null)) throw new CrmNotFoundException("Related clinical record is not available.");
        if (relations.Any(r => r is not null && r.PatientId != item.PatientId)) throw CrmRules.Error("PatientId", "Related clinical records must belong to the selected patient.");
        var zone = CrmRules.Zone(await store.GetTimeZoneAsync(token)); item.Update(c.Input.Type, CrmRules.Utc(c.Input.DueDate, c.Input.DueTime, zone), c.Input.Title, c.Input.Notes,
            c.Input.RelatedAppointmentId, c.Input.RelatedTreatmentPlanId, c.Input.RelatedTreatmentId, c.Input.RelatedPrescriptionId, c.Version, clock.UtcNow);
        store.AddAudit(new(tenant.RequireTenantId(), user.UserId, PlatformAuditAction.FollowUpUpdated, nameof(FollowUp), item.Id, clock.UtcNow, null)); await store.SaveChangesAsync(token); return true;
    }
}

internal sealed class AssignFollowUp(ICrmStore store, IPermissionService permissions, ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : IAssignFollowUp
{
    public async Task<bool> ExecuteAsync(Guid id, Guid assigned, Guid version, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.CrmAssignFollowUp, token); var item = await store.FindFollowUpAsync(id, true, token); if (item is null) return false; if (await store.FindUserAsync(assigned, token) is not { IsActive: true }) throw new CrmNotFoundException("Assignee is not available."); item.Assign(assigned, version, clock.UtcNow); store.AddAudit(new(tenant.RequireTenantId(), user.UserId, PlatformAuditAction.FollowUpAssigned, nameof(FollowUp), id, clock.UtcNow, null)); await store.SaveChangesAsync(token); return true; }
}

internal sealed class FollowUpLifecycle(ICrmStore store, IPermissionService permissions, ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : IFollowUpLifecycle
{
    public async Task<bool> ExecuteAsync(Guid id, string action, Guid version, CancellationToken token)
    {
        var permission = action.ToLowerInvariant() switch { "start" => Permissions.CrmEditFollowUp, "complete" => Permissions.CrmCompleteFollowUp, "cancel" => Permissions.CrmCancelFollowUp, _ => throw CrmRules.Error("Action", "Unknown follow-up action.") };
        await permissions.EnsurePermissionAsync(permission, token); var item = await store.FindFollowUpAsync(id, true, token); if (item is null) return false;
        var audit = action.ToLowerInvariant() switch { "start" => Start(item, version), "complete" => Complete(item, version), "cancel" => Cancel(item, version), _ => throw new InvalidOperationException() };
        store.AddAudit(new(tenant.RequireTenantId(), user.UserId, audit, nameof(FollowUp), id, clock.UtcNow, null)); await store.SaveChangesAsync(token); return true;
    }
    private PlatformAuditAction Start(FollowUp x, Guid v) { x.Start(v, clock.UtcNow); return PlatformAuditAction.FollowUpStarted; }
    private PlatformAuditAction Complete(FollowUp x, Guid v) { x.Complete(v, clock.UtcNow); return PlatformAuditAction.FollowUpCompleted; }
    private PlatformAuditAction Cancel(FollowUp x, Guid v) { x.Cancel(v, clock.UtcNow); return PlatformAuditAction.FollowUpCancelled; }
}

internal sealed class CommunicationActivityService(ICrmStore store, IPermissionService permissions, ICurrentTenant tenant, ICurrentUser user, ISystemClock clock) : ICommunicationActivityService
{
    public async Task<IReadOnlyCollection<CommunicationActivityItem>> GetAsync(Guid patientId, int take, CancellationToken token)
    { await permissions.EnsurePermissionAsync(Permissions.CrmViewActivities, token); return await store.GetActivitiesAsync(patientId, Math.Clamp(take, 1, 100), token); }
    public async Task<Guid> CreateAsync(CommunicationActivityInput input, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(Permissions.CrmCreateActivity, token); if (await store.FindPatientAsync(input.PatientId, token) is null) throw new CrmNotFoundException("Patient is not available.");
        var actor = user.UserId ?? throw new ForbiddenAccessException("An authenticated user is required."); var zone = CrmRules.Zone(await store.GetTimeZoneAsync(token));
        var item = new CommunicationActivity(tenant.RequireTenantId(), input.PatientId, actor, input.Type, input.Direction, input.Subject, input.Notes, CrmRules.Utc(input.OccurredDate, input.OccurredTime, zone), clock.UtcNow);
        store.AddActivity(item); store.AddAudit(new(tenant.RequireTenantId(), actor, PlatformAuditAction.CommunicationActivityCreated, nameof(CommunicationActivity), item.Id, clock.UtcNow, null)); await store.SaveChangesAsync(token); return item.Id;
    }
}
