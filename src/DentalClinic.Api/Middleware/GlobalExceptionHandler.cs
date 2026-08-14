using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Contracts.Errors;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;

namespace DentalClinic.Api.Middleware;

internal sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment environment) : IExceptionHandler
{
    private static readonly Action<ILogger, Exception?> LogUnhandled =
        LoggerMessage.Define(LogLevel.Error, new EventId(1000, "UnhandledRequestException"),
            "Unhandled request exception");

    private static readonly Action<ILogger, int, string, Exception?> LogRejected =
        LoggerMessage.Define<int, string>(LogLevel.Warning, new EventId(1001, "RequestRejected"),
            "Request rejected with status {StatusCode}: {ErrorType}");

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title, detail, errors) = exception switch
        {
            ValidationException validation => (
                StatusCodes.Status400BadRequest,
                "Validation failed",
                "One or more validation errors occurred.",
                validation.Errors.GroupBy(x => x.PropertyName)
                    .ToDictionary(x => x.Key, x => x.Select(y => y.ErrorMessage).ToArray())),
            ForbiddenAccessException => (
                StatusCodes.Status403Forbidden,
                "Forbidden",
                exception.Message,
                null),
            TenantUnavailableException => (
                StatusCodes.Status401Unauthorized,
                "Tenant context required",
                exception.Message,
                null),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Unexpected error",
                environment.IsDevelopment() ? exception.Message : "An unexpected error occurred.",
                null)
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            LogUnhandled(logger, exception);
        }
        else
        {
            LogRejected(logger, status, exception.GetType().Name, null);
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(new ApiErrorResponse(
            $"https://httpstatuses.io/{status}",
            title,
            status,
            detail,
            httpContext.TraceIdentifier,
            errors), cancellationToken);
        return true;
    }
}
