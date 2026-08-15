using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Finance;

public enum FinancePeriod { Today = 1, ThisWeek = 2, ThisMonth = 3, ThisYear = 4, Custom = 5 }
public sealed record FinanceDateFilter(FinancePeriod Period = FinancePeriod.ThisMonth, DateOnly? From = null, DateOnly? To = null);
public sealed record FinanceRange(DateTimeOffset From, DateTimeOffset To, string TimeZone, string Currency);
public sealed record FinancialCategoryInput(string Name, string Code, FinancialCategoryType Type, Guid? ParentId);
public sealed record FinancialCategoryItem(Guid Id, string Name, string Code, FinancialCategoryType Type, Guid? ParentId,
    string? ParentName, bool IsActive, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, Guid Version);
public sealed record RevenueItem(Guid Id, Guid CategoryId, string CategoryName, Guid? PatientId, string? PatientName,
    Guid? TreatmentId, string? TreatmentName, Guid? DoctorProfileId, string? DoctorName, decimal Amount, decimal Paid,
    decimal Outstanding, string Currency, string Description, DateTimeOffset OccurredAt);
public sealed record RevenueSearch(string? Search = null, Guid? PatientId = null, Guid? DoctorProfileId = null,
    Guid? TreatmentId = null, Guid? CategoryId = null, DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);
public sealed record PaymentInput(Guid? PatientId, Guid? RevenueId, Guid? TreatmentId, decimal Amount,
    PaymentMethod PaymentMethod, string? Reference, string? Notes, DateOnly PaidDate, TimeOnly PaidTime);
public sealed record PaymentItem(Guid Id, Guid? PatientId, string? PatientName, Guid RevenueId, Guid? TreatmentId,
    decimal Amount, string Currency, PaymentMethod PaymentMethod, string? Reference, DateTimeOffset PaidAt, DateTimeOffset CreatedAt);
public sealed record PaymentSearch(Guid? PatientId = null, Guid? RevenueId = null, Guid? TreatmentId = null,
    DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);
public sealed record ExpenseInput(Guid CategoryId, decimal Amount, string? Currency, string Description, string? VendorName,
    string? Reference, DateOnly ExpenseDate, TimeOnly ExpenseTime, string? Notes);
public sealed record ExpenseItem(Guid Id, Guid CategoryId, string CategoryName, decimal Amount, string Currency,
    string Description, string? VendorName, string? Reference, DateTimeOffset ExpenseDate, DateTimeOffset CreatedAt);
public sealed record ExpenseSearch(Guid? CategoryId = null, DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);
public sealed record PatientBalance(Guid PatientId, decimal TotalRevenue, decimal TotalPaid, decimal Outstanding, string Currency);
public sealed record FinanceSummary(decimal Revenue, decimal Payments, decimal Outstanding, decimal Expenses,
    decimal DoctorCompensation, decimal NetProfit, string Currency, DateTimeOffset From, DateTimeOffset To, string TimeZone,
    IReadOnlyCollection<FinanceNamedAmount> RevenueByCategory, IReadOnlyCollection<FinanceNamedAmount> RevenueByDoctor,
    IReadOnlyCollection<FinanceNamedAmount> ExpensesByCategory, IReadOnlyCollection<FinanceDailyAmount> RevenueByDay,
    IReadOnlyCollection<FinanceDailyAmount> ExpensesByDay);
public sealed record FinanceNamedAmount(Guid? Id, string Name, decimal Amount);
public sealed record FinanceDailyAmount(DateOnly Date, decimal Amount);
public sealed record FinancePatient(Guid Id, string Name, bool IsActive);
public sealed record FinanceTreatment(Guid Id, Guid PatientId, Guid DoctorProfileId, Guid? TreatmentPlanId,
    string Name, TreatmentStatus Status, decimal Amount, DateTimeOffset? CompletedAt);
public sealed record FinanceDoctorRule(Guid Id, CompensationType Type, decimal? FixedAmount, decimal? Percentage,
    DateOnly EffectiveFrom, DateOnly? EffectiveTo);
public sealed record CompensationResult(decimal Amount, decimal? Percentage, string Snapshot);

public interface IFinanceQueries
{
    Task<FinanceSummary> DashboardAsync(FinanceDateFilter filter, CancellationToken token);
    Task<PagedResult<RevenueItem>> RevenuesAsync(RevenueSearch search, CancellationToken token);
    Task<PagedResult<PaymentItem>> PaymentsAsync(PaymentSearch search, CancellationToken token);
    Task<PagedResult<ExpenseItem>> ExpensesAsync(ExpenseSearch search, CancellationToken token);
    Task<PatientBalance?> PatientBalanceAsync(Guid patientId, CancellationToken token);
    Task<RevenueItem?> RevenueAsync(Guid id, CancellationToken token);
}
public interface IFinancialCategoryService
{
    Task<IReadOnlyCollection<FinancialCategoryItem>> ListAsync(bool includeInactive, FinancialCategoryType? type, CancellationToken token);
    Task<Guid> CreateAsync(FinancialCategoryInput input, CancellationToken token);
    Task<bool> UpdateAsync(Guid id, FinancialCategoryInput input, Guid version, CancellationToken token);
    Task<bool> SetActiveAsync(Guid id, bool active, Guid version, CancellationToken token);
}
public interface IPaymentService { Task<Guid> CreateAsync(PaymentInput input, CancellationToken token); }
public interface IExpenseService { Task<Guid> CreateAsync(ExpenseInput input, CancellationToken token); }
public interface ITreatmentRevenueCreator { Task EnsureForCompletedTreatmentAsync(Guid treatmentId, CancellationToken token); }
public interface IDoctorCompensationCalculator { CompensationResult Calculate(FinanceDoctorRule? rule, decimal treatmentAmount); }
