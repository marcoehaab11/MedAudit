using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using DentalClinic.Contracts.Finance;
using DentalClinic.Domain.Finance;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class FinanceEndpoints
{
    public static IEndpointRouteBuilder MapFinanceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/finance").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        api.MapGet("/dashboard", (FinancePeriod period, DateOnly? from, DateOnly? to, IFinanceQueries x, CancellationToken t) => x.DashboardAsync(new(period == 0 ? FinancePeriod.ThisMonth : period, from, to), t)).RequireAuthorization(Permissions.FinanceDashboard);
        api.MapGet("/categories", (bool includeInactive, FinancialCategoryType? type, IFinancialCategoryService x, CancellationToken t) => x.ListAsync(includeInactive, type, t)).RequireAuthorization(Permissions.FinanceCategoriesView);
        api.MapPost("/categories", async (FinancialCategoryRequest r, IFinancialCategoryService x, CancellationToken t) => { var id = await x.CreateAsync(new(r.Name, r.Code, (FinancialCategoryType)r.Type, r.ParentId), t); return Results.Created($"/api/finance/categories/{id:D}", new { id }); }).RequireAuthorization(Permissions.FinanceCategoriesManage);
        api.MapPut("/categories/{id:guid}", async (Guid id, UpdateFinancialCategoryRequest r, IFinancialCategoryService x, CancellationToken t) => await x.UpdateAsync(id, new(r.Category.Name, r.Category.Code, (FinancialCategoryType)r.Category.Type, r.Category.ParentId), r.Version, t) ? Results.NoContent() : Results.NotFound()).RequireAuthorization(Permissions.FinanceCategoriesManage);
        api.MapPost("/categories/{id:guid}/status", async (Guid id, CategoryStatusRequest r, IFinancialCategoryService x, CancellationToken t) => await x.SetActiveAsync(id, r.IsActive, r.Version, t) ? Results.NoContent() : Results.NotFound()).RequireAuthorization(Permissions.FinanceCategoriesManage);
        api.MapGet("/revenue", SearchRevenue).RequireAuthorization(Permissions.FinanceRevenueView);
        api.MapGet("/revenue/{id:guid}", async (Guid id, IFinanceQueries x, CancellationToken t) => await x.RevenueAsync(id, t) is { } item ? Results.Ok(item) : Results.NotFound()).RequireAuthorization(Permissions.FinanceRevenueView);
        api.MapGet("/payments", SearchPayments).RequireAuthorization(Permissions.FinancePaymentsView);
        api.MapPost("/payments", async (PaymentRequest r, IPaymentService x, CancellationToken t) => { var id = await x.CreateAsync(new(r.PatientId, r.RevenueId, r.TreatmentId, r.Amount, (PaymentMethod)r.PaymentMethod, r.Reference, r.Notes, r.PaidDate, r.PaidTime), t); return Results.Created($"/api/finance/payments/{id:D}", new { id }); }).RequireAuthorization(Permissions.FinancePaymentsCreate);
        api.MapGet("/expenses", SearchExpenses).RequireAuthorization(Permissions.FinanceExpensesView);
        api.MapPost("/expenses", async (ExpenseRequest r, IExpenseService x, CancellationToken t) => { var id = await x.CreateAsync(new(r.CategoryId, r.Amount, r.Currency, r.Description, r.VendorName, r.Reference, r.ExpenseDate, r.ExpenseTime, r.Notes), t); return Results.Created($"/api/finance/expenses/{id:D}", new { id }); }).RequireAuthorization(Permissions.FinanceExpensesCreate);
        api.MapGet("/patients/{patientId:guid}/balance", async (Guid patientId, IFinanceQueries x, CancellationToken t) => await x.PatientBalanceAsync(patientId, t) is { } item ? Results.Ok(item) : Results.NotFound()).RequireAuthorization(Permissions.FinanceView);
        return endpoints;
    }
    private static Task<DentalClinic.Application.Tenants.Models.PagedResult<RevenueItem>> SearchRevenue(string? search, Guid? patientId, Guid? doctorProfileId, Guid? treatmentId, Guid? categoryId, DateOnly? from, DateOnly? to, int page, int pageSize, IFinanceQueries x, CancellationToken t) => x.RevenuesAsync(new(search, patientId, doctorProfileId, treatmentId, categoryId, from, to, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t);
    private static Task<DentalClinic.Application.Tenants.Models.PagedResult<PaymentItem>> SearchPayments(Guid? patientId, Guid? revenueId, Guid? treatmentId, DateOnly? from, DateOnly? to, int page, int pageSize, IFinanceQueries x, CancellationToken t) => x.PaymentsAsync(new(patientId, revenueId, treatmentId, from, to, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t);
    private static Task<DentalClinic.Application.Tenants.Models.PagedResult<ExpenseItem>> SearchExpenses(Guid? categoryId, DateOnly? from, DateOnly? to, int page, int pageSize, IFinanceQueries x, CancellationToken t) => x.ExpensesAsync(new(categoryId, from, to, page == 0 ? 1 : page, pageSize == 0 ? 20 : pageSize), t);
}
