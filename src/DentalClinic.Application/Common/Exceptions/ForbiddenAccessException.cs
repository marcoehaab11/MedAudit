namespace DentalClinic.Application.Common.Exceptions;

public sealed class ForbiddenAccessException(string message) : Exception(message);
