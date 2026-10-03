using DentalClinic.Application.Identity;
using DentalClinic.Domain.ClinicBusiness;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Services;

namespace DentalClinic.Api.Endpoints;

internal static class ClinicBusinessEndpoints
{
    public sealed record VendorRequest(string Name, string? Phone, string? Notes);
    public sealed record PayerRequest(string Name, InsurancePayerKind Kind, string? ContractNumber);

    public static IEndpointRouteBuilder MapClinicBusinessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var lab = endpoints.MapGroup("/api/lab").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        lab.MapGet("/vendors", (ClinicBusinessService s, CancellationToken t) => s.VendorsAsync(t)).RequireAuthorization(Permissions.LabView);
        lab.MapPost("/vendors", async (VendorRequest r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddVendorAsync(r.Name, r.Phone, r.Notes, t) })).RequireAuthorization(Permissions.LabManage);
        lab.MapGet("/cases", (Guid? patientId, ClinicBusinessService s, CancellationToken t) => s.CasesAsync(patientId, t)).RequireAuthorization(Permissions.LabView);
        lab.MapPost("/cases", async (LabCaseInput r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddCaseAsync(r, t) })).RequireAuthorization(Permissions.LabManage);
        lab.MapPost("/cases/{id:guid}/status", async (Guid id, LabCaseUpdate r, ClinicBusinessService s, CancellationToken t) => { await s.ChangeCaseAsync(id, r, t); return Results.NoContent(); }).RequireAuthorization(Permissions.LabManage);
        lab.MapGet("/statements", (ClinicBusinessService s, CancellationToken t) => s.StatementsAsync(t)).RequireAuthorization(Permissions.LabView);
        lab.MapPost("/statements", async (StatementInput r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddStatementAsync(r, t) })).RequireAuthorization(Permissions.LabManage);
        lab.MapGet("/statements/{id:guid}", (Guid id, ClinicBusinessService s, CancellationToken t) => s.StatementAsync(id, t)).RequireAuthorization(Permissions.LabView);
        lab.MapPost("/statements/{id:guid}/payments", async (Guid id, SettlementInput r, ClinicBusinessService s, CancellationToken t) => { await s.SettleStatementAsync(id, r, t); return Results.NoContent(); }).RequireAuthorization(Permissions.LabSettle);
        lab.MapGet("/cases/{id:guid}/history", (Guid id, ClinicBusinessService s, CancellationToken t) => s.HistoryAsync("LabCase", id, t)).RequireAuthorization(Permissions.LabView);
        lab.MapGet("/cases/{id:guid}/documents", (Guid id, ClinicBusinessService s, CancellationToken t) => s.DocumentsAsync("LabCase", id, t)).RequireAuthorization(Permissions.LabView);
        lab.MapPost("/cases/{id:guid}/documents", async (Guid id, IFormFile file, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddDocumentAsync("LabCase", id, file.FileName, file.ContentType, file.OpenReadStream(), t) })).DisableAntiforgery().RequireAuthorization(Permissions.LabManage);
        lab.MapGet("/documents/{id:guid}", async (Guid id, ClinicBusinessService s, CancellationToken t) => await s.DocumentAsync("LabCase", id, t) is { } d ? Results.File(d.Content, d.ContentType, d.FileName) : Results.NotFound()).RequireAuthorization(Permissions.LabView);

        var insurance = endpoints.MapGroup("/api/insurance").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        insurance.MapGet("/payers", (ClinicBusinessService s, CancellationToken t) => s.PayersAsync(t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/payers", async (PayerRequest r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddPayerAsync(r.Name, r.Kind, r.ContractNumber, t) })).RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapGet("/policies", (Guid? patientId, ClinicBusinessService s, CancellationToken t) => s.PoliciesAsync(patientId, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/policies", async (PolicyInput r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddPolicyAsync(r, t) })).RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapGet("/claims", (Guid? patientId, ClinicBusinessService s, CancellationToken t) => s.ClaimsAsync(patientId, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapGet("/summary", (ClinicBusinessService s, CancellationToken t) => s.InsuranceSummaryAsync(t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapGet("/claims/{id:guid}", (Guid id, ClinicBusinessService s, CancellationToken t) => s.ClaimAsync(id, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/claims", async (ClaimInput r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddClaimAsync(r, t) })).RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapPost("/claims/{id:guid}/status", async (Guid id, ClaimUpdate r, ClinicBusinessService s, CancellationToken t) => { await s.ChangeClaimAsync(id, r, t); return Results.NoContent(); }).RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapGet("/claims/{id:guid}/history", (Guid id, ClinicBusinessService s, CancellationToken t) => s.HistoryAsync("InsuranceClaim", id, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapGet("/claims/{id:guid}/documents", (Guid id, ClinicBusinessService s, CancellationToken t) => s.DocumentsAsync("InsuranceClaim", id, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/claims/{id:guid}/documents", async (Guid id, IFormFile file, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddDocumentAsync("InsuranceClaim", id, file.FileName, file.ContentType, file.OpenReadStream(), t) })).DisableAntiforgery().RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapGet("/documents/{id:guid}", async (Guid id, ClinicBusinessService s, CancellationToken t) => await s.DocumentAsync("InsuranceClaim", id, t) is { } d ? Results.File(d.Content, d.ContentType, d.FileName) : Results.NotFound()).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapGet("/batches", (ClinicBusinessService s, CancellationToken t) => s.BatchesAsync(t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/batches", async (BatchInput r, ClinicBusinessService s, CancellationToken t) => Results.Ok(new { id = await s.AddBatchAsync(r, t) })).RequireAuthorization(Permissions.InsuranceManage);
        insurance.MapGet("/batches/{id:guid}", (Guid id, ClinicBusinessService s, CancellationToken t) => s.BatchAsync(id, t)).RequireAuthorization(Permissions.InsuranceView);
        insurance.MapPost("/settlements", async (SettlementInput r, ClinicBusinessService s, CancellationToken t) => { await s.SettleClaimsAsync(r, t); return Results.NoContent(); }).RequireAuthorization(Permissions.InsuranceSettle);
        return endpoints;
    }
}
