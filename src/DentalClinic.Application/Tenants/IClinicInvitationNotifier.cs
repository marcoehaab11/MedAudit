namespace DentalClinic.Application.Tenants;

public interface IClinicInvitationNotifier
{
    Task SendAsync(
        Guid invitationId,
        string email,
        string token,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken);
}
