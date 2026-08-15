using DentalClinic.Application.Finance;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;

namespace DentalClinic.UnitTests;

public sealed class FinanceDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid User = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PaymentRequiresPositiveMoney() => Assert.Throws<ArgumentOutOfRangeException>(() =>
        new Payment(Tenant, null, Guid.NewGuid(), null, 0, "USD", PaymentMethod.Cash, null, null, Now, User, Now));
    [Fact]
    public void CurrencyIsExplicitAndNormalized()
    { var x = new Revenue(Tenant, Guid.NewGuid(), null, null, null, null, 10, "usd", "Consultation", Now, Now); Assert.Equal("USD", x.Currency); }
    [Fact]
    public void ExpenseRequiresDescriptionAndPositiveAmount()
    { Assert.Throws<ArgumentOutOfRangeException>(() => new Expense(Tenant, Guid.NewGuid(), -1, "USD", "Rent", null, null, Now, User, null, Now)); Assert.Throws<ArgumentException>(() => new Expense(Tenant, Guid.NewGuid(), 1, "USD", "", null, null, Now, User, null, Now)); }
    [Fact]
    public void CategoryRejectsSelfParentAndStaleVersion()
    { var x = new FinancialCategory(Tenant, "Rent", "rent", FinancialCategoryType.Expense, null, Now); Assert.Throws<FinanceConcurrencyException>(() => x.Update("Rent", "RENT", FinancialCategoryType.Expense, null, Guid.NewGuid(), Now)); Assert.Throws<ArgumentException>(() => x.Update("Rent", "RENT", FinancialCategoryType.Expense, x.Id, x.Version, Now)); }
    [Fact]
    public void PercentageCompensationUsesHistoricalRuleSnapshot()
    { var rule = new FinanceDoctorRule(Guid.NewGuid(), CompensationType.Percentage, null, 20, new(2026, 1, 1), null); var x = new DoctorCompensationCalculator().Calculate(rule, 5000); Assert.Equal(1000, x.Amount); Assert.Contains("Percentage=20", x.Snapshot); }
    [Fact]
    public void CombinedCompensationExcludesFixedSalary()
    { var rule = new FinanceDoctorRule(Guid.NewGuid(), CompensationType.FixedSalaryAndPercentage, 10000, 15, new(2026, 1, 1), null); var x = new DoctorCompensationCalculator().Calculate(rule, 1000); Assert.Equal(150, x.Amount); Assert.DoesNotContain("10000", x.Snapshot); }
    [Fact]
    public void FixedSalaryIsNotAllocatedToTreatment()
    { var rule = new FinanceDoctorRule(Guid.NewGuid(), CompensationType.FixedSalary, 10000, null, new(2026, 1, 1), null); Assert.Equal(0, new DoctorCompensationCalculator().Calculate(rule, 1000).Amount); }
    [Fact]
    public void PostedRecordsExposeNoMutationOrDeletionMethods()
    { var types = new[] { typeof(Revenue), typeof(Payment), typeof(Expense), typeof(DoctorCompensationCost), typeof(FinancialTransaction) }; Assert.All(types, t => Assert.DoesNotContain(t.GetMethods(), m => m.DeclaringType == t && m.IsPublic && !m.IsSpecialName)); }
}
