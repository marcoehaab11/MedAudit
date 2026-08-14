using DentalClinic.Application.Tenants;
using Microsoft.Extensions.Logging;

namespace DentalClinic.Infrastructure.Identity;

internal sealed class LoggingClinicInvitationNotifier(
    ILogger<LoggingClinicInvitationNotifier> logger) : IClinicInvitationNotifier
{
    private static readonly Action<ILogger, Guid, DateTimeOffset, Exception?> LogInvitationPrepared =
        LoggerMessage.Define<Guid, DateTimeOffset>(
            LogLevel.Information,
            new EventId(3000, "AdminInvitationPrepared"),
            "Admin invitation {InvitationId} is ready for delivery and expires at {ExpiresAt}");

    public Task SendAsync(
        Guid invitationId,
        string email,
        string token,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        LogInvitationPrepared(logger, invitationId, expiresAt, null);
        return Task.CompletedTask;
    }
}
