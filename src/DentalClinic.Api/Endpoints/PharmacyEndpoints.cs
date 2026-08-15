using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Pharmacy;
using DentalClinic.Domain.Pharmacy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace DentalClinic.Api.Endpoints;

public static class PharmacyEndpoints
{
    public static IEndpointRouteBuilder MapPharmacyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/pharmacy").RequireAuthorization();

        group.MapGet("/dashboard", async (IPharmacyService service, CancellationToken token) =>
        {
            var summary = await service.GetDashboardSummaryAsync(token);
            return Results.Ok(summary);
        });

        group.MapGet("/dispensings", async (
            Guid? patientId,
            string? prescriptionNumber,
            string? medicationSearch,
            Guid? pharmacistId,
            DateTimeOffset? fromDate,
            DateTimeOffset? toDate,
            DispensingStatus? status,
            int? pageNumber,
            int? pageSize,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            var result = await service.GetDispensingsAsync(
                patientId, prescriptionNumber, medicationSearch, pharmacistId, fromDate, toDate, status, pageNumber ?? 1, pageSize ?? 20, token
            );
            return Results.Ok(result);
        });

        group.MapGet("/dispensings/{id:guid}", async (Guid id, IPharmacyService service, CancellationToken token) =>
        {
            var dispensing = await service.GetDispensingByIdAsync(id, token);
            return dispensing != null ? Results.Ok(dispensing) : Results.NotFound();
        });

        group.MapGet("/prescriptions", async (
            string? search,
            int? pageNumber,
            int? pageSize,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            var result = await service.GetPrescriptionsReadyForDispensingAsync(
                search, pageNumber ?? 1, pageSize ?? 20, token
            );
            return Results.Ok(result);
        });

        group.MapGet("/prescriptions/{id:guid}", async (Guid id, IPharmacyService service, CancellationToken token) =>
        {
            var rx = await service.GetPrescriptionDispensingDetailAsync(id, token);
            return rx != null ? Results.Ok(rx) : Results.NotFound();
        });

        group.MapPost("/prescriptions/{id:guid}/dispense", async (
            Guid id,
            DispensePrescriptionRequest request,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            try
            {
                var command = new DispensePrescriptionCommand(id, request.Items, request.Notes);
                var result = await service.DispensePrescriptionAsync(command, token);
                return Results.Created($"/api/pharmacy/dispensings/{result.Id}", result);
            }
            catch (InsufficientStockException ex)
            {
                return Results.Conflict(new { error = ex.Message, code = "INSUFFICIENT_STOCK" });
            }
            catch (PharmacyDispensingException ex)
            {
                return Results.Conflict(new { error = ex.Message, code = "DISPENSING_ERROR" });
            }
            catch (PharmacyConcurrencyException ex)
            {
                return Results.Conflict(new { error = ex.Message, code = "CONCURRENCY_CONFLICT" });
            }
        });

        group.MapPost("/dispensings/{id:guid}/reverse", async (
            Guid id,
            ReverseDispensingRequest request,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            try
            {
                var command = new ReverseDispensingCommand(id, request.Reason);
                var result = await service.ReverseDispensingAsync(command, token);
                return Results.Ok(result);
            }
            catch (PharmacyDispensingException ex)
            {
                return Results.Conflict(new { error = ex.Message, code = "REVERSAL_ERROR" });
            }
        });

        group.MapGet("/catalog", async (
            string? search,
            bool? activeOnly,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            var result = await service.GetMedicationCatalogAsync(search, activeOnly, token);
            return Results.Ok(result);
        });

        group.MapPost("/catalog/{id:guid}/inventory-mapping", async (
            Guid id,
            UpdateMedicationInventoryMappingCommand command,
            IPharmacyService service,
            CancellationToken token
        ) =>
        {
            await service.UpdateMedicationInventoryMappingAsync(id, command, token);
            return Results.NoContent();
        });

        group.MapGet("/patients/{patientId:guid}/history", async (Guid patientId, IPharmacyService service, CancellationToken token) =>
        {
            var history = await service.GetPatientPharmacyHistoryAsync(patientId, token);
            return Results.Ok(history);
        });

        return endpoints;
    }
}

public sealed record DispensePrescriptionRequest(
    IReadOnlyCollection<DispensePrescriptionItemCommand> Items,
    string? Notes
);

public sealed record ReverseDispensingRequest(
    string Reason
);
