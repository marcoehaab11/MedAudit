using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Finance;

public interface IFinanceTransaction : IAsyncDisposable { Task CommitAsync(CancellationToken token); }
public interface IFinanceStore
{
    Task<FinanceRange> ResolveRangeAsync(FinanceDateFilter filter, CancellationToken token);
    Task<string> CurrencyAsync(CancellationToken token);
    Task<FinancePatient?> FindPatientAsync(Guid id, CancellationToken token);
    Task<FinanceTreatment?> FindTreatmentAsync(Guid id, CancellationToken token);
    Task<FinanceDoctorRule?> FindCompensationRuleAsync(Guid doctorId, DateOnly treatmentDate, CancellationToken token);
    Task<FinancialCategory?> FindCategoryAsync(Guid id, bool tracking, CancellationToken token);
    Task<FinancialCategory?> FindCategoryByCodeAsync(string code, FinancialCategoryType type, CancellationToken token);
    Task<bool> CategoryCodeExistsAsync(string code, Guid? excludeId, CancellationToken token);
    Task<bool> CategoryHasReferencesAsync(Guid id, CancellationToken token);
    Task<bool> CategoryCreatesCycleAsync(Guid id, Guid? parentId, CancellationToken token);
    Task<IReadOnlyCollection<FinancialCategoryItem>> CategoriesAsync(bool includeInactive, FinancialCategoryType? type, CancellationToken token);
    Task<Revenue?> FindRevenueAsync(Guid id, CancellationToken token);
    Task<Revenue?> FindRevenueByTreatmentAsync(Guid treatmentId, CancellationToken token);
    Task<RevenueItem?> RevenueAsync(Guid id, CancellationToken token);
    Task<FinanceSummary> DashboardAsync(FinanceRange range, CancellationToken token);
    Task<PagedResult<RevenueItem>> RevenuesAsync(RevenueSearch search, FinanceRange range, CancellationToken token);
    Task<PagedResult<PaymentItem>> PaymentsAsync(PaymentSearch search, FinanceRange range, CancellationToken token);
    Task<PagedResult<ExpenseItem>> ExpensesAsync(ExpenseSearch search, FinanceRange range, CancellationToken token);
    Task<PatientBalance?> PatientBalanceAsync(Guid patientId, CancellationToken token);
    Task<decimal> PaidForRevenueAsync(Guid revenueId, CancellationToken token);
    Task<IFinanceTransaction> BeginTransactionAsync(CancellationToken token);
    Task LockRevenueAsync(Guid revenueId, CancellationToken token);
    void AddCategory(FinancialCategory item); void AddRevenue(Revenue item); void AddPayment(Payment item);
    void AddExpense(Expense item); void AddDoctorCost(DoctorCompensationCost item); void AddTransaction(FinancialTransaction item);
    void AddAudit(PlatformAuditLog item);
    Task SaveChangesAsync(CancellationToken token);
}
