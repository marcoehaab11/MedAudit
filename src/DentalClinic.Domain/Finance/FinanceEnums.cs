namespace DentalClinic.Domain.Finance;

public enum FinancialCategoryType { Revenue = 1, Expense = 2 }
public enum PaymentMethod { Cash = 1, Card = 2, BankTransfer = 3, Other = 4 }
public enum FinancialTransactionType { Revenue = 1, Payment = 2, Expense = 3, DoctorCompensation = 4, Refund = 5, Reversal = 6 }
public enum FinancialSourceType { Treatment = 1, Revenue = 2, Payment = 3, Expense = 4, DoctorCompensation = 5 }

public sealed class FinanceConcurrencyException(string message) : Exception(message);
public sealed class FinanceConflictException(string message) : Exception(message);
public sealed class FinanceNotFoundException(string message) : Exception(message);

internal static class FinanceRules
{
    public static decimal Positive(decimal value, string name) => value > 0 && value <= 999_999_999_999.99m
        ? decimal.Round(value, 2, MidpointRounding.AwayFromZero)
        : throw new ArgumentOutOfRangeException(name, "Amount must be greater than zero and within the supported range.");
    public static decimal NonNegative(decimal value, string name) => value >= 0 && value <= 999_999_999_999.99m
        ? decimal.Round(value, 2, MidpointRounding.AwayFromZero)
        : throw new ArgumentOutOfRangeException(name, "Amount cannot be negative and must be within the supported range.");
    public static string Currency(string value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length == 3
        ? value.Trim().ToUpperInvariant()
        : throw new ArgumentException("A three-letter currency code is required.", nameof(value));
    public static string Required(string value, string name, int max)
    { var x = value?.Trim(); return !string.IsNullOrWhiteSpace(x) && x.Length <= max ? x : throw new ArgumentException($"{name} is required and cannot exceed {max} characters.", name); }
    public static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Required(value, name, max);
}
