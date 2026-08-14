namespace DentalClinic.Contracts.Errors;

public sealed record ApiErrorResponse(
    string Type,
    string Title,
    int Status,
    string Detail,
    string TraceId,
    IReadOnlyDictionary<string, string[]>? Errors = null);
