using System.Data.Common;
using System.Security.Claims;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

public sealed class DatabaseSecurityContext(
    IHttpContextAccessor http, ICurrentTenant tenant, DatabaseAccessScope access, PlatformWriteScope writes)
{
    // Every command replaces EVERY setting, including empty values. Npgsql also resets
    // pooled connections on close. SET LOCAL is used whenever a transaction exists.
    private DbCommand Command(DbConnection connection, DbTransaction? transaction)
    {
        var principal = http.HttpContext?.User;
        var authenticated = principal?.Identity?.IsAuthenticated == true;
        var identity = authenticated ? principal!.FindFirstValue(VerifiedSessionEvents.IdentityClaim) : null;
        var member = authenticated ? principal!.FindFirstValue("sub") : null;
        var tenantId = authenticated ? tenant.TenantId?.ToString("D") : null;
        var values = new Dictionary<string, string>
        {
            ["identity"] = Guid.TryParse(identity, out var id) ? id.ToString("D") : "",
            ["member"] = Guid.TryParse(member, out var membership) ? membership.ToString("D") : "",
            ["tenant"] = tenantId ?? "",
            ["purpose"] = access.Purpose,
            ["provision_tenant"] = writes.TenantId?.ToString("D") ?? "",
            ["slug"] = access.PublicSlug,
            ["management_hash"] = access.ManagementHash,
            ["phone"] = access.PatientPhone,
            ["idempotency"] = access.IdempotencyKey,
            ["created_appointment"] = access.CreatedAppointmentId?.ToString("D") ?? "",
            ["created_patient"] = access.CreatedPatientId?.ToString("D") ?? "",
            ["created_inquiry"] = access.CreatedInquiryId?.ToString("D") ?? ""
        };
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        var expressions = new List<string>();
        foreach (var (key, value) in values)
        {
            expressions.Add($"set_config('meddentist.{key}', @{key}, @local)");
            command.Parameters.Add(new NpgsqlParameter(key, value));
        }
        command.Parameters.Add(new NpgsqlParameter("local", transaction is not null));
        command.CommandText = "SELECT " + string.Join(", ", expressions);
        return command;
    }

    public void Apply(DbConnection connection, DbTransaction? transaction)
    {
        using var command = Command(connection, transaction);
        command.ExecuteNonQuery();
    }

    public async Task ApplyAsync(DbConnection connection, DbTransaction? transaction, CancellationToken token = default)
    {
        await using var command = Command(connection, transaction);
        await command.ExecuteNonQueryAsync(token);
    }
}
