using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Finance;

internal sealed class FinanceTenantInitializer(IPlatformClinicStore store, ISystemClock clock) : ITenantInitializer
{
    private static readonly (string Name, string Code, FinancialCategoryType Type)[] Defaults =
    [
        ("Treatment Revenue", "TREATMENT_REVENUE", FinancialCategoryType.Revenue),
        ("Consultation Revenue", "CONSULTATION_REVENUE", FinancialCategoryType.Revenue),
        ("Other Revenue", "OTHER_REVENUE", FinancialCategoryType.Revenue),
        ("Rent", "RENT", FinancialCategoryType.Expense), ("Electricity", "ELECTRICITY", FinancialCategoryType.Expense),
        ("Gas", "GAS", FinancialCategoryType.Expense), ("Water", "WATER", FinancialCategoryType.Expense),
        ("Internet", "INTERNET", FinancialCategoryType.Expense), ("Materials", "MATERIALS", FinancialCategoryType.Expense),
        ("Maintenance", "MAINTENANCE", FinancialCategoryType.Expense), ("Marketing", "MARKETING", FinancialCategoryType.Expense),
        ("Administrative", "ADMINISTRATIVE", FinancialCategoryType.Expense), ("Salaries", "SALARIES", FinancialCategoryType.Expense),
        ("Doctor Compensation", "DOCTOR_COMPENSATION", FinancialCategoryType.Expense), ("Other", "OTHER_EXPENSE", FinancialCategoryType.Expense)
    ];
    public Task InitializeAsync(Tenant tenant, CancellationToken cancellationToken)
    { foreach (var x in Defaults) store.AddFinancialCategory(new(tenant.Id, x.Name, x.Code, x.Type, null, clock.UtcNow)); return Task.CompletedTask; }
}
