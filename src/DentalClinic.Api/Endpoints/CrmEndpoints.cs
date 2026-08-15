using DentalClinic.Application.Crm;
using DentalClinic.Application.Identity;
using DentalClinic.Contracts.Crm;
using DentalClinic.Domain.Crm;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class CrmEndpoints
{
    public static IEndpointRouteBuilder MapCrmEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/crm").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        api.MapGet("/dashboard", (IFollowUpQueries x, CancellationToken t) => x.DashboardAsync(t)).RequireAuthorization(Permissions.CrmView);
        api.MapGet("/users", (IFollowUpQueries x, CancellationToken t) => x.AssignableUsersAsync(t)).RequireAuthorization(Permissions.CrmAssignFollowUp);
        api.MapGet("/follow-ups", Search).RequireAuthorization(Permissions.CrmView);
        api.MapGet("/follow-ups/{id:guid}", async (Guid id, IFollowUpQueries x, CancellationToken t) => await x.GetAsync(id, t) is { } item ? Results.Ok(item) : Results.NotFound()).RequireAuthorization(Permissions.CrmView);
        api.MapPost("/follow-ups", Create).RequireAuthorization(Permissions.CrmCreateFollowUp);
        api.MapPut("/follow-ups/{id:guid}", Update).RequireAuthorization(Permissions.CrmEditFollowUp);
        api.MapPost("/follow-ups/{id:guid}/assign", Assign).RequireAuthorization(Permissions.CrmAssignFollowUp);
        api.MapPost("/follow-ups/{id:guid}/{action}", Action);
        api.MapGet("/patients/{patientId:guid}", async (Guid patientId, IFollowUpQueries x, CancellationToken t) => await x.PatientSummaryAsync(patientId, t) is { } item ? Results.Ok(item) : Results.NotFound()).RequireAuthorization(Permissions.CrmView);
        api.MapGet("/patients/{patientId:guid}/activities", (Guid patientId, int take, ICommunicationActivityService x, CancellationToken t) => x.GetAsync(patientId, take == 0 ? 20 : take, t)).RequireAuthorization(Permissions.CrmViewActivities);
        api.MapPost("/activities", CreateActivity).RequireAuthorization(Permissions.CrmCreateActivity);
        return endpoints;
    }
    private static Task<DentalClinic.Application.Tenants.Models.PagedResult<FollowUpListItem>> Search(string? search, FollowUpStatus? status,
        FollowUpType? type, Guid? assignedToUserId, Guid? patientId, DateOnly? dueFrom, DateOnly? dueTo, bool? overdue,
        FollowUpSortField sortBy, bool descending, int page, int pageSize, IFollowUpQueries x, CancellationToken t) =>
        x.SearchAsync(new(search, status, type, assignedToUserId, patientId, dueFrom, dueTo, overdue,
            sortBy == 0 ? FollowUpSortField.DueAt : sortBy, descending, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t);
    private static async Task<IResult> Create(FollowUpRequest r, ICreateFollowUp x, CancellationToken t)
    { var id = await x.ExecuteAsync(Input(r), t); return Results.Created($"/api/crm/follow-ups/{id:D}", new { id }); }
    private static async Task<IResult> Update(Guid id, UpdateFollowUpRequest r, IUpdateFollowUp x, CancellationToken t) => await x.ExecuteAsync(new(id, Input(r.FollowUp), r.Version), t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> Assign(Guid id, AssignFollowUpRequest r, IAssignFollowUp x, CancellationToken t) => await x.ExecuteAsync(id, r.AssignedToUserId, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> Action(Guid id, string action, FollowUpActionRequest r, IFollowUpLifecycle x, CancellationToken t) => await x.ExecuteAsync(id, action, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> CreateActivity(CommunicationActivityRequest r, ICommunicationActivityService x, CancellationToken t)
    { var id = await x.CreateAsync(new(r.PatientId, (CommunicationType)r.Type, (CommunicationDirection)r.Direction, r.Subject, r.Notes, r.OccurredDate, r.OccurredTime), t); return Results.Created($"/api/crm/activities/{id:D}", new { id }); }
    private static FollowUpInput Input(FollowUpRequest r) => new(r.PatientId, r.AssignedToUserId, (FollowUpType)r.Type,
        r.DueDate, r.DueTime, r.Title, r.Notes, r.RelatedAppointmentId, r.RelatedTreatmentPlanId, r.RelatedTreatmentId, r.RelatedPrescriptionId);
}
