using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.Api.Endpoints;

internal static class BackupEndpoints
{
    public sealed record BackupExportRequest(string[] Modules, string Password);

    public static IEndpointRouteBuilder MapBackupEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var backup = endpoints.MapGroup("/api/backups")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy, Permissions.BackupCreate);
        backup.MapGet("/modules", () => ClinicBackupService.Modules);
        backup.MapPost("/export", async (BackupExportRequest request, ClinicBackupService service, ICurrentTenant tenant, CancellationToken token) =>
        {
            var file = await service.ExportAsync(tenant.RequireTenantId(), request.Modules, request.Password, token);
            return Results.File(file.Stream, "application/octet-stream", file.Name);
        });
        return endpoints;
    }
}
