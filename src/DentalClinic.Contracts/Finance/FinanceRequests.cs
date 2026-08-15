namespace DentalClinic.Contracts.Finance;

public sealed record FinancialCategoryRequest(string Name, string Code, int Type, Guid? ParentId);
public sealed record UpdateFinancialCategoryRequest(FinancialCategoryRequest Category, Guid Version);
public sealed record CategoryStatusRequest(bool IsActive, Guid Version);
public sealed record PaymentRequest(Guid? PatientId, Guid? RevenueId, Guid? TreatmentId, decimal Amount,
    int PaymentMethod, string? Reference, string? Notes, DateOnly PaidDate, TimeOnly PaidTime);
public sealed record ExpenseRequest(Guid CategoryId, decimal Amount, string? Currency, string Description,
    string? VendorName, string? Reference, DateOnly ExpenseDate, TimeOnly ExpenseTime, string? Notes);
