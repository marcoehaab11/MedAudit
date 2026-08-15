using DentalClinic.Application.Identity;
using DentalClinic.Application.Treatments;
using DentalClinic.Contracts.Treatments;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class TreatmentEndpoints
{
    public static IEndpointRouteBuilder MapTreatmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        api.MapGet("/treatment-catalog", (bool includeInactive, ITreatmentCatalogService s, CancellationToken t) => s.ListAsync(includeInactive, t)).RequireAuthorization(Permissions.TreatmentCatalogView);
        api.MapPost("/treatment-catalog", CreateCatalog).RequireAuthorization(Permissions.TreatmentCatalogManage);
        api.MapPut("/treatment-catalog/{id:guid}", UpdateCatalog).RequireAuthorization(Permissions.TreatmentCatalogManage);
        api.MapGet("/treatment-plans", (Guid? patientId, Guid? doctorProfileId, TreatmentPlanStatus? status, DateOnly? from, DateOnly? to, int page, int pageSize, ITreatmentPlanService s, CancellationToken t) => s.SearchAsync(new(patientId, doctorProfileId, status, from, to, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t)).RequireAuthorization(Permissions.TreatmentPlansView);
        api.MapGet("/treatment-plans/{id:guid}", GetPlan).RequireAuthorization(Permissions.TreatmentPlansView);
        api.MapPost("/treatment-plans", CreatePlan).RequireAuthorization(Permissions.TreatmentPlansCreate);
        api.MapPut("/treatment-plans/{id:guid}", UpdatePlan).RequireAuthorization(Permissions.TreatmentPlansEdit);
        api.MapPost("/treatment-plans/{id:guid}/items", AddPlanItem).RequireAuthorization(Permissions.TreatmentPlansEdit);
        api.MapPut("/treatment-plans/{id:guid}/items/{itemId:guid}", UpdatePlanItem).RequireAuthorization(Permissions.TreatmentPlansEdit);
        api.MapDelete("/treatment-plans/{id:guid}/items/{itemId:guid}", RemovePlanItem).RequireAuthorization(Permissions.TreatmentPlansEdit);
        api.MapPost("/treatment-plans/{id:guid}/{action:regex(^(propose|accept|reject|cancel|start|complete)$)}", TransitionPlan);
        api.MapGet("/treatments", (Guid? patientId, Guid? doctorProfileId, TreatmentType? type, TreatmentStatus? status, DateOnly? from, DateOnly? to, int? toothNumber, int page, int pageSize, ITreatmentService s, CancellationToken t) => s.SearchAsync(new(patientId, doctorProfileId, type, status, from, to, toothNumber, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t)).RequireAuthorization(Permissions.TreatmentsView);
        api.MapGet("/treatments/{id:guid}", GetTreatment).RequireAuthorization(Permissions.TreatmentsView);
        api.MapPost("/treatments", CreateTreatment).RequireAuthorization(Permissions.TreatmentsCreate);
        api.MapPut("/treatments/{id:guid}", UpdateTreatment).RequireAuthorization(Permissions.TreatmentsEdit);
        api.MapPost("/treatments/{id:guid}/{action:regex(^(start|complete|cancel)$)}", TransitionTreatment);
        return endpoints;
    }
    private static async Task<IResult> CreateCatalog(CatalogItemRequest r, ITreatmentCatalogService s, CancellationToken t) { var id = await s.CreateAsync(Catalog(r), t); return Results.Created($"/api/treatment-catalog/{id:D}", new { id }); }
    private static async Task<IResult> UpdateCatalog(Guid id, CatalogItemRequest r, ITreatmentCatalogService s, CancellationToken t) => await s.UpdateAsync(id, Catalog(r), t) ? Results.NoContent() : Results.NotFound();
    private static CatalogItemInput Catalog(CatalogItemRequest r) => new((TreatmentType)r.Type, r.Name, r.Code, r.Description, r.DefaultPrice, r.IsActive);
    private static async Task<IResult> GetPlan(Guid id, ITreatmentPlanService s, CancellationToken t) => await s.GetAsync(id, t) is { } x ? Results.Ok(x) : Results.NotFound();
    private static async Task<IResult> CreatePlan(CreateTreatmentPlanRequest r, ITreatmentPlanService s, CancellationToken t) { var id = await s.CreateAsync(new(r.PatientId, r.DoctorProfileId, r.Title, r.Notes, r.DiscountAmount, r.Items.Select(Item).ToArray()), t); return Results.Created($"/api/treatment-plans/{id:D}", new { id }); }
    private static async Task<IResult> UpdatePlan(Guid id, UpdateTreatmentPlanRequest r, ITreatmentPlanService s, CancellationToken t) => await s.UpdateAsync(new(id, r.Title, r.Notes, r.DiscountAmount, r.Version), t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> AddPlanItem(Guid id, PlanItemRequest r, Guid version, ITreatmentPlanService s, CancellationToken t) => await s.AddItemAsync(id, Item(r), version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> UpdatePlanItem(Guid id, Guid itemId, UpdatePlanItemRequest r, ITreatmentPlanService s, CancellationToken t) => await s.UpdateItemAsync(new(id, itemId, r.ToothNumber, r.Quantity, r.DiscountAmount, r.Notes, r.Version), t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> RemovePlanItem(Guid id, Guid itemId, Guid version, ITreatmentPlanService s, CancellationToken t) => await s.RemoveItemAsync(id, itemId, version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> TransitionPlan(Guid id, string action, TreatmentVersionRequest r, ITreatmentPlanService s, CancellationToken t) => await s.TransitionAsync(id, action, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static PlanItemInput Item(PlanItemRequest r) => new(r.CatalogItemId, r.ToothNumber, r.Quantity, r.DiscountAmount, r.Notes);
    private static async Task<IResult> GetTreatment(Guid id, ITreatmentService s, CancellationToken t) => await s.GetAsync(id, t) is { } x ? Results.Ok(x) : Results.NotFound();
    private static async Task<IResult> CreateTreatment(CreateTreatmentRequest r, ITreatmentService s, CancellationToken t) { var id = await s.CreateAsync(new(r.PatientId, r.DoctorProfileId, r.CatalogItemId, r.AppointmentId, r.TreatmentPlanItemId, r.SourceDentalProcedureId, r.ToothNumbers, r.Notes), t); return Results.Created($"/api/treatments/{id:D}", new { id }); }
    private static async Task<IResult> UpdateTreatment(Guid id, UpdateTreatmentNotesRequest r, ITreatmentService s, CancellationToken t) => await s.UpdateNotesAsync(id, r.Notes, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> TransitionTreatment(Guid id, string action, TreatmentVersionRequest r, ITreatmentService s, CancellationToken t) => await s.TransitionAsync(id, action, r.Version, t) ? Results.NoContent() : Results.NotFound();
}
