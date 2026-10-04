using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Services;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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
        backup.MapPost("/export-clinic", async (BackupExportRequest request, ClinicBackupService service,
            ApplicationDbContext db, IIdentityStore identities, ICurrentTenant tenant, ICurrentUser user, CancellationToken token) =>
        {
            var tenantId = tenant.RequireTenantId();
            var roles = await identities.GetRoleNamesForUserAsync(tenantId, user.UserId!.Value, token);
            if (!roles.Contains(SystemRoleDefinitions.ClinicAdmin, StringComparer.Ordinal)) return Results.Forbid();
            var current = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, token);
            var clinicId = current.ParentClinicId ?? current.Id;
            var file = await service.ExportClinicGroupAsync(clinicId, request.Password, token);
            return Results.File(file.Stream, "application/octet-stream", file.Name);
        });
        return endpoints;
    }
}
