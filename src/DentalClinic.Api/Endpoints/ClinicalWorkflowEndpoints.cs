using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.Api.Endpoints;

internal static class ClinicalWorkflowEndpoints
{
    public static IEndpointRouteBuilder MapClinicalWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/treatments").RequireAuthorization(AuthConstants.TenantMemberPolicy, Permissions.DentalView);
        api.MapGet("/{id:guid}/clinical-workflow", (Guid id, ClinicalWorkflowService service, CancellationToken token) => service.GetAsync(id, token));
        api.MapPut("/{id:guid}/clinical-workflow", (Guid id, SaveClinicalWorkflowRequest request, ClinicalWorkflowService service, CancellationToken token) => service.SaveAsync(id, request, token))
            .RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        api.MapGet("/{id:guid}/clinical-files", (Guid id, ClinicalWorkflowService service, CancellationToken token) => service.PhotosAsync(id, token));
        api.MapPost("/{id:guid}/clinical-workflow/sessions/{sessionId:guid}/correct", (Guid id, Guid sessionId, CorrectClinicalSessionRequest request, ClinicalWorkflowService service, CancellationToken token) => service.CorrectSessionAsync(id, sessionId, request, token))
            .RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        api.MapGet("/{id:guid}/clinical-files/{fileId:guid}", async (Guid id, Guid fileId, HttpContext context, ClinicalWorkflowService service, CancellationToken token) =>
        {
            var file = await service.PhotoAsync(id, fileId, token); context.Response.Headers.CacheControl = "private, no-store"; context.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(file.Content, file.ContentType, file.FileName);
        });
        api.MapPost("/{id:guid}/clinical-files", UploadAsync).RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit)
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(11_000_000));
        api.MapDelete("/{id:guid}/clinical-files/{fileId:guid}", async (Guid id, Guid fileId, ClinicalWorkflowService service, CancellationToken token) =>
        {
            await service.DeletePhotoAsync(id, fileId, token); return Results.NoContent();
        }).RequireAuthorization(Permissions.DentalEdit, Permissions.ExaminationEdit);
        return endpoints;
    }
    private static async Task<IResult> UploadAsync(Guid id, HttpRequest request, ClinicalWorkflowService service, CancellationToken token)
    {
        if (!request.HasFormContentType || request.ContentLength > 11_000_000) return Results.BadRequest(new { detail = "Choose a photo smaller than 10 MB." });
        var form = await request.ReadFormAsync(token); var file = form.Files.GetFile("file");
        if (file is null || file.Length is 0 or > 10_000_000 || !Guid.TryParse(form["sessionId"], out var sessionId)) return Results.BadRequest(new { detail = "Choose a valid session and photo smaller than 10 MB." });
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, token);
        return Results.Ok(await service.AddPhotoAsync(id, sessionId, form["category"].ToString(), file.FileName, buffer.ToArray(), token));
    }
}
