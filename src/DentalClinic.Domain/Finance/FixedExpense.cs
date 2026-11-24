
using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Finance;

public sealed class FixedExpenseSchedule : TenantOwnedEntity
{
    private FixedExpenseSchedule() { }

    public FixedExpenseSchedule(Guid tenantId, Guid categoryId, string name, string beneficiary,
        decimal monthlyAmount, int dueDay, DateOnly startsOn)
    {
        if (dueDay is < 1 or > 31)
            throw new ArgumentOutOfRangeException(nameof(dueDay), "The due day must be between 1 and 31.");
        if (startsOn.Year is < 1900 or > 9998)
            throw new ArgumentOutOfRangeException(nameof(startsOn));
        if (monthlyAmount != decimal.Round(monthlyAmount, 2))
            throw new ArgumentOutOfRangeException(nameof(monthlyAmount), "The monthly amount must use at most two decimal places.");
        TenantId = tenantId;
        CategoryId = categoryId;
        Name = FinanceRules.Required(name, nameof(name), 500);
        Beneficiary = FinanceRules.Required(beneficiary, nameof(beneficiary), 200);
        MonthlyAmount = FinanceRules.Positive(monthlyAmount, nameof(monthlyAmount));
        DueDay = dueDay;
        StartsOn = startsOn;
    }

    public Guid CategoryId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Beneficiary { get; private set; } = string.Empty;
    public decimal MonthlyAmount { get; private set; }
    public int DueDay { get; private set; }
    public DateOnly StartsOn { get; private set; }
}

public sealed class FixedExpenseDue : TenantOwnedEntity
{
    private FixedExpenseDue() { }

    public Guid ScheduleId { get; private set; }
    public DateOnly Month { get; private set; }
    public DateOnly DueDate { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public Guid? ExpenseId { get; private set; }

    public void Settle(Guid expenseId)
    {
        if (ExpenseId.HasValue) throw new FinanceConflictException("This expense has already been paid.");
        ExpenseId = expenseId;
    }
}
