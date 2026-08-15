using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Dental;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;
using DentalClinic.Application.Treatments;
using DentalClinic.Application.Prescriptions;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Application.Crm;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Finance;
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
            AppointmentConflictException => (
                StatusCodes.Status409Conflict,
                "Appointment conflict",
                exception.Message,
                null),
            DentalConcurrencyException => (
                StatusCodes.Status409Conflict,
                "Clinical record conflict",
                exception.Message,
                null),
            DentalStateException => (
                StatusCodes.Status409Conflict,
                "Clinical workflow conflict",
                exception.Message,
                null),
            DentalNotFoundException or KeyNotFoundException => (
                StatusCodes.Status404NotFound,
                "Clinical record not found",
                exception.Message,
                null),
            TreatmentConcurrencyException => (
                StatusCodes.Status409Conflict, "Treatment conflict", exception.Message, null),
            TreatmentStateException => (
                StatusCodes.Status409Conflict, "Treatment workflow conflict", exception.Message, null),
            TreatmentNotFoundException => (
                StatusCodes.Status404NotFound, "Treatment record not found", exception.Message, null),
            ArgumentException => (
                StatusCodes.Status400BadRequest,
                "Invalid request",
                exception.Message,
                null),
            PrescriptionConcurrencyException => (
                StatusCodes.Status409Conflict, "Prescription conflict", exception.Message, null),
            PrescriptionStateException => (
                StatusCodes.Status409Conflict, "Prescription workflow conflict", exception.Message, null),
            PrescriptionNotFoundException => (
                StatusCodes.Status404NotFound, "Prescription not found", "The prescription or related clinical record is not available.", null),
            FollowUpConcurrencyException => (
                StatusCodes.Status409Conflict, "Follow-up conflict", exception.Message, null),
            FollowUpStateException => (
                StatusCodes.Status409Conflict, "Follow-up workflow conflict", exception.Message, null),
            CrmNotFoundException => (
                StatusCodes.Status404NotFound, "CRM record not found", "The requested CRM or related record is not available.", null),
            FinanceConcurrencyException or FinanceConflictException => (
                StatusCodes.Status409Conflict, "Financial conflict", exception.Message, null),
            FinanceNotFoundException => (
                StatusCodes.Status404NotFound, "Financial record not found", exception.Message, null),
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
