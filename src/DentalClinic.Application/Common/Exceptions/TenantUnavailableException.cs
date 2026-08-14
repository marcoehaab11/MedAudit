namespace DentalClinic.Application.Common.Exceptions;

public sealed class TenantUnavailableException() : Exception("A trusted tenant context is required.");
