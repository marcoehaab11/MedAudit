using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Inventory;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace DentalClinic.Api.Endpoints;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/inventory").RequireAuthorization();

        group.MapGet("/summary", async (IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetDashboardSummaryAsync(token);
            return Results.Ok(result);
        });

        group.MapGet("/categories", async (IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetCategoriesAsync(token);
            return Results.Ok(result);
        });

        group.MapPost("/categories", async (UpsertInventoryCategoryCommand command, IInventoryService service, CancellationToken token) =>
        {
            var id = await service.UpsertCategoryAsync(null, command, token);
            return Results.Created($"/api/inventory/categories/{id}", new { id });
        });

        group.MapPut("/categories/{id:guid}", async (Guid id, UpsertInventoryCategoryCommand command, IInventoryService service, CancellationToken token) =>
        {
            var updatedId = await service.UpsertCategoryAsync(id, command, token);
            return Results.Ok(new { id = updatedId });
        });

        group.MapGet("/suppliers", async (IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetSuppliersAsync(token);
            return Results.Ok(result);
        });

        group.MapPost("/suppliers", async (UpsertSupplierCommand command, IInventoryService service, CancellationToken token) =>
        {
            var id = await service.UpsertSupplierAsync(null, command, token);
            return Results.Created($"/api/inventory/suppliers/{id}", new { id });
        });

        group.MapPut("/suppliers/{id:guid}", async (Guid id, UpsertSupplierCommand command, IInventoryService service, CancellationToken token) =>
        {
            var updatedId = await service.UpsertSupplierAsync(id, command, token);
            return Results.Ok(new { id = updatedId });
        });

        group.MapGet("/items", async (string? search, Guid? categoryId, bool? lowStockOnly, IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetItemsAsync(search, categoryId, lowStockOnly, token);
            return Results.Ok(result);
        });

        group.MapGet("/items/{id:guid}", async (Guid id, IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetItemByIdAsync(id, token);
            return result != null ? Results.Ok(result) : Results.NotFound();
        });

        group.MapPost("/items", async (UpsertInventoryItemCommand command, IInventoryService service, CancellationToken token) =>
        {
            var id = await service.UpsertItemAsync(null, command, token);
            return Results.Created($"/api/inventory/items/{id}", new { id });
        });

        group.MapPut("/items/{id:guid}", async (Guid id, UpsertInventoryItemCommand command, IInventoryService service, CancellationToken token) =>
        {
            var updatedId = await service.UpsertItemAsync(id, command, token);
            return Results.Ok(new { id = updatedId });
        });

        group.MapGet("/movements", async (Guid? itemId, int? take, IInventoryService service, CancellationToken token) =>
        {
            var result = await service.GetMovementsAsync(itemId, take ?? 50, token);
            return Results.Ok(result);
        });

        group.MapPost("/receive", async (ReceiveStockCommand command, IInventoryService service, CancellationToken token) =>
        {
            var id = await service.ReceiveStockAsync(command, token);
            return Results.Ok(new { id });
        });

        group.MapPost("/issue", async (IssueStockCommand command, IInventoryService service, CancellationToken token) =>
        {
            try
            {
                var id = await service.IssueStockAsync(command, token);
                return Results.Ok(new { id });
            }
            catch (InsufficientStockException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        group.MapPost("/adjust", async (AdjustStockCommand command, IInventoryService service, CancellationToken token) =>
        {
            try
            {
                var id = await service.AdjustStockAsync(command, token);
                return Results.Ok(new { id });
            }
            catch (InsufficientStockException ex)
            {
                return Results.Conflict(new { error = ex.Message });
            }
        });

        return endpoints;
    }
}
