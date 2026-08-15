using DentalClinic.Application.Identity;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Contracts.Prescriptions;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class PrescriptionEndpoints
{
    public static IEndpointRouteBuilder MapPrescriptionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        api.MapGet("/medications", (string? search, MedicationForm? form, bool includeInactive, int page, int pageSize, IMedicationCatalogService s, CancellationToken t) => s.SearchAsync(new(search, form, includeInactive, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t)).RequireAuthorization(Permissions.PrescriptionsView);
        api.MapPost("/medications", CreateMedication).RequireAuthorization(Permissions.SettingsEdit);
        api.MapPut("/medications/{id:guid}", UpdateMedication).RequireAuthorization(Permissions.SettingsEdit);
        api.MapGet("/prescriptions", (Guid? patientId, Guid? doctorProfileId, PrescriptionStatus? status, DateOnly? from, DateOnly? to, int page, int pageSize, IPrescriptionService s, CancellationToken t) => s.SearchAsync(new(patientId, doctorProfileId, status, from, to, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t)).RequireAuthorization(Permissions.PrescriptionsView);
        api.MapGet("/prescriptions/{id:guid}", Get).RequireAuthorization(Permissions.PrescriptionsView);
        api.MapPost("/prescriptions", Create).RequireAuthorization(Permissions.PrescriptionsCreate);
        api.MapPut("/prescriptions/{id:guid}", Update).RequireAuthorization(Permissions.PrescriptionsEdit);
        api.MapPost("/prescriptions/{id:guid}/items", AddItem).RequireAuthorization(Permissions.PrescriptionsEdit);
        api.MapPut("/prescriptions/{id:guid}/items/{itemId:guid}", UpdateItem).RequireAuthorization(Permissions.PrescriptionsEdit);
        api.MapDelete("/prescriptions/{id:guid}/items/{itemId:guid}", RemoveItem).RequireAuthorization(Permissions.PrescriptionsEdit);
        api.MapPost("/prescriptions/{id:guid}/issue", Issue).RequireAuthorization(Permissions.PrescriptionsIssue);
        api.MapPost("/prescriptions/{id:guid}/cancel", Cancel).RequireAuthorization(Permissions.PrescriptionsCancel);
        api.MapGet("/prescriptions/{id:guid}/document", Download).RequireAuthorization(Permissions.PrescriptionsDownload);
        api.MapGet("/prescriptions/{id:guid}/print", Print).RequireAuthorization(Permissions.PrescriptionsPrint);
        api.MapGet("/prescriptions/{id:guid}/qr", Qr).RequireAuthorization(Permissions.PrescriptionsView);
        return endpoints;
    }
    private static async Task<IResult> CreateMedication(MedicationCatalogRequest r, IMedicationCatalogService s, CancellationToken t) { var id = await s.CreateAsync(Medication(r), t); return Results.Created($"/api/medications/{id:D}", new { id }); }
    private static async Task<IResult> UpdateMedication(Guid id, MedicationCatalogRequest r, IMedicationCatalogService s, CancellationToken t) => await s.UpdateAsync(id, Medication(r), t) ? Results.NoContent() : Results.NotFound();
    private static MedicationCatalogInput Medication(MedicationCatalogRequest r) => new(r.Name, r.GenericName, r.Strength, r.Form.HasValue ? (MedicationForm)r.Form : null, r.Notes, r.IsActive);
    private static async Task<IResult> Get(Guid id, IPrescriptionService s, CancellationToken t) => await s.GetAsync(id, t) is { } x ? Results.Ok(x) : Results.NotFound();
    private static async Task<IResult> Create(CreatePrescriptionRequest r, IPrescriptionService s, CancellationToken t) { var id = await s.CreateAsync(new(r.PatientId, r.DoctorProfileId, r.AppointmentId, r.ExaminationId, r.TreatmentId, r.Notes, r.Items.Select(Item).ToArray()), t); return Results.Created($"/api/prescriptions/{id:D}", new { id }); }
    private static async Task<IResult> Update(Guid id, UpdatePrescriptionRequest r, IPrescriptionService s, CancellationToken t) => await s.UpdateAsync(new(id, r.PatientId, r.DoctorProfileId, r.AppointmentId, r.ExaminationId, r.TreatmentId, r.Notes, r.Version), t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> AddItem(Guid id, PrescriptionItemRequest r, Guid version, IPrescriptionService s, CancellationToken t) => await s.AddItemAsync(id, Item(r), version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> UpdateItem(Guid id, Guid itemId, UpdatePrescriptionItemRequest r, IPrescriptionService s, CancellationToken t) => await s.UpdateItemAsync(new(id, itemId, r.Dose, r.Frequency, r.Duration, r.Route, r.Instructions, r.Quantity, r.SortOrder, r.Version), t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> RemoveItem(Guid id, Guid itemId, Guid version, IPrescriptionService s, CancellationToken t) => await s.RemoveItemAsync(id, itemId, version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> Issue(Guid id, PrescriptionVersionRequest r, IPrescriptionService s, CancellationToken t) => await s.IssueAsync(id, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> Cancel(Guid id, PrescriptionVersionRequest r, IPrescriptionService s, CancellationToken t) => await s.CancelAsync(id, r.Version, t) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> Download(Guid id, IPrescriptionService s, CancellationToken t) => await s.DownloadAsync(id, false, t) is { } x ? Results.File(x.Content, x.ContentType, x.FileName) : Results.NotFound();
    private static async Task<IResult> Print(Guid id, IPrescriptionService s, CancellationToken t) => await s.DownloadAsync(id, true, t) is { } x ? Results.File(x.Content, x.ContentType, x.FileName, enableRangeProcessing: false) : Results.NotFound();
    private static async Task<IResult> Qr(Guid id, IPrescriptionService s, CancellationToken t) => await s.GetQrSvgAsync(id, t) is { } x ? Results.Text(x, "image/svg+xml") : Results.NotFound();
    private static PrescriptionItemInput Item(PrescriptionItemRequest r) => new(r.MedicationId, r.MedicationName, r.GenericName, r.Strength, r.Form.HasValue ? (MedicationForm)r.Form : null, r.Dose, r.Frequency, r.Duration, r.Route, r.Instructions, r.Quantity, r.SortOrder);
}
