using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.Api.Endpoints;

internal static class ImplantEndpoints
{
    public sealed record CreateImplantRequest(int ToothNumber, Guid AppointmentId, Guid? TreatmentId);
    public static IEndpointRouteBuilder MapImplantEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization(AuthConstants.TenantMemberPolicy, Permissions.DentalView);
        api.MapGet("/patients/{patientId:guid}/implants", (Guid patientId, ImplantService service, CancellationToken token) => service.ListAsync(patientId, token));
        api.MapPost("/patients/{patientId:guid}/implants", (Guid patientId, CreateImplantRequest request, ImplantService service, CancellationToken token) =>
            service.CreateAsync(patientId, request.ToothNumber, request.AppointmentId, request.TreatmentId, token)).RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        api.MapGet("/implants/{id:guid}", (Guid id, ImplantService service, CancellationToken token) => service.GetAsync(id, token));
        api.MapPut("/implants/{id:guid}", (Guid id, SaveImplantRequest request, ImplantService service, CancellationToken token) => service.SaveAsync(id, request, token))
            .RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        api.MapGet("/implants/{id:guid}/files", (Guid id, ImplantService service, CancellationToken token) => service.FilesAsync(id, token));
        api.MapPost("/implants/{id:guid}/files", UploadAsync).RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(11_000_000));
        api.MapGet("/implants/{id:guid}/files/{fileId:guid}", async (Guid id, Guid fileId, HttpContext context, ImplantService service, CancellationToken token) =>
        {
            var file = await service.FileAsync(id, fileId, token);
            context.Response.Headers.CacheControl = "private, no-store";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(file.Content, file.ContentType, file.FileName);
        });
        api.MapDelete("/implants/{id:guid}/files/{fileId:guid}", async (Guid id, Guid fileId, ImplantService service, CancellationToken token) =>
        { await service.DeleteFileAsync(id, fileId, token); return Results.NoContent(); }).RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        return endpoints;
    }
    private static async Task<IResult> UploadAsync(Guid id, HttpRequest request, ImplantService service, CancellationToken token)
    {
        if (!request.HasFormContentType || request.ContentLength > 11_000_000) return Results.BadRequest(new { detail = "Choose a file smaller than 10 MB." });
        var form = await request.ReadFormAsync(token);
        var file = form.Files.GetFile("file");
        if (file is null || file.Length is 0 or > 10_000_000) return Results.BadRequest(new { detail = "Choose a file smaller than 10 MB." });
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, token);
        return Results.Ok(await service.AddFileAsync(id, form["section"].ToString(), file.FileName, buffer.ToArray(), token));
    }
}
