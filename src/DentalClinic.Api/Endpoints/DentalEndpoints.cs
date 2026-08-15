using DentalClinic.Application.Dental;
using DentalClinic.Application.Identity;
using DentalClinic.Contracts.Dental;
using DentalClinic.Domain.Dental;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class DentalEndpoints
{
    public static IEndpointRouteBuilder MapDentalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var tenant = endpoints.MapGroup("/api").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        tenant.MapGet("/patients/{patientId:guid}/dental", ChartAsync).RequireAuthorization(Permissions.DentalView);
        tenant.MapGet("/patients/{patientId:guid}/examinations", HistoryAsync).RequireAuthorization(Permissions.DentalHistoryView);
        tenant.MapGet("/examinations/{id:guid}", GetAsync).RequireAuthorization(Permissions.ExaminationView);
        tenant.MapGet("/appointments/{appointmentId:guid}/examination", GetByAppointmentAsync).RequireAuthorization(Permissions.ExaminationView);
        tenant.MapPost("/appointments/{appointmentId:guid}/examination", CreateAsync).RequireAuthorization(Permissions.ExaminationCreate);
        tenant.MapPut("/examinations/{id:guid}", NotesAsync).RequireAuthorization(Permissions.ExaminationEdit);
        tenant.MapPost("/examinations/{id:guid}/findings", AddFindingAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPut("/examinations/{id:guid}/findings/{itemId:guid}", UpdateFindingAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapDelete("/examinations/{id:guid}/findings/{itemId:guid}", RemoveFindingAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPost("/examinations/{id:guid}/procedures", AddProcedureAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPut("/examinations/{id:guid}/procedures/{itemId:guid}", UpdateProcedureAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapDelete("/examinations/{id:guid}/procedures/{itemId:guid}", RemoveProcedureAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPost("/examinations/{id:guid}/endodontic", AddEndodonticAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPut("/examinations/{id:guid}/endodontic/{itemId:guid}", UpdateEndodonticAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapDelete("/examinations/{id:guid}/endodontic/{itemId:guid}", RemoveEndodonticAsync)
            .RequireAuthorization(Permissions.ExaminationEdit, Permissions.DentalEdit);
        tenant.MapPost("/examinations/{id:guid}/complete", CompleteAsync).RequireAuthorization(Permissions.ExaminationComplete);
        return endpoints;
    }

    private static async Task<IResult> ChartAsync(Guid patientId, IDentalQueries queries, CancellationToken token) =>
        await queries.GetChartAsync(patientId, token) is { } item ? Results.Ok(item) : Results.NotFound();
    private static Task<IReadOnlyCollection<ExaminationHistoryItem>> HistoryAsync(Guid patientId, int take,
        IDentalQueries queries, CancellationToken token) => queries.GetHistoryAsync(patientId, take is 0 ? 20 : take, token);
    private static async Task<IResult> GetAsync(Guid id, IDentalQueries queries, CancellationToken token) =>
        await queries.GetExaminationAsync(id, token) is { } item ? Results.Ok(item) : Results.NotFound();
    private static async Task<IResult> GetByAppointmentAsync(Guid appointmentId, IDentalQueries queries, CancellationToken token) =>
        await queries.GetByAppointmentAsync(appointmentId, token) is { } item ? Results.Ok(item) : Results.NotFound();
    private static async Task<IResult> CreateAsync(Guid appointmentId, IExaminationCommands commands, CancellationToken token)
    { var id = await commands.CreateAsync(appointmentId, token); return Results.Created($"/api/examinations/{id:D}", new { id }); }
    private static Task<IResult> NotesAsync(Guid id, UpdateExaminationNotesRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.UpdateNotesAsync(id, request.Notes, request.Version, token));
    private static Task<IResult> AddFindingAsync(Guid id, DentalRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.AddFindingAsync(id, Finding(request), request.Version, token));
    private static Task<IResult> UpdateFindingAsync(Guid id, Guid itemId, DentalRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.UpdateFindingAsync(id, itemId, Finding(request), request.Version, token));
    private static Task<IResult> RemoveFindingAsync(Guid id, Guid itemId, ClinicalRecordVersionRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.RemoveFindingAsync(id, itemId, request.Version, token));
    private static Task<IResult> AddProcedureAsync(Guid id, DentalRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.AddProcedureAsync(id, Procedure(request), request.Version, token));
    private static Task<IResult> UpdateProcedureAsync(Guid id, Guid itemId, DentalRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.UpdateProcedureAsync(id, itemId, Procedure(request), request.Version, token));
    private static Task<IResult> RemoveProcedureAsync(Guid id, Guid itemId, ClinicalRecordVersionRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.RemoveProcedureAsync(id, itemId, request.Version, token));
    private static Task<IResult> AddEndodonticAsync(Guid id, EndodonticRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.AddEndodonticAsync(id, Endodontic(request), request.Version, token));
    private static Task<IResult> UpdateEndodonticAsync(Guid id, Guid itemId, EndodonticRecordRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.UpdateEndodonticAsync(id, itemId, Endodontic(request), request.Version, token));
    private static Task<IResult> RemoveEndodonticAsync(Guid id, Guid itemId, ClinicalRecordVersionRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.RemoveEndodonticAsync(id, itemId, request.Version, token));
    private static Task<IResult> CompleteAsync(Guid id, ClinicalRecordVersionRequest request, IExaminationCommands commands, CancellationToken token) =>
        ResultAsync(commands.CompleteAsync(id, request.Version, token));
    private static DentalRecordInput<DentalFindingType> Finding(DentalRecordRequest r) =>
        new(r.ToothNumber, (DentalFindingType)r.Type, r.Surfaces.Select(x => (ToothSurface)x).ToArray(), r.Notes);
    private static DentalRecordInput<DentalProcedureType> Procedure(DentalRecordRequest r) =>
        new(r.ToothNumber, (DentalProcedureType)r.Type, r.Surfaces.Select(x => (ToothSurface)x).ToArray(), r.Notes);
    private static EndodonticInput Endodontic(EndodonticRecordRequest r) => new(r.ToothNumber, r.Notes,
        r.Canals.Select(x => new EndodonticCanalInput(x.Name, x.LengthMm, x.Notes)).ToArray());
    private static async Task<IResult> ResultAsync(Task<bool> result) => await result ? Results.NoContent() : Results.NotFound();
}
