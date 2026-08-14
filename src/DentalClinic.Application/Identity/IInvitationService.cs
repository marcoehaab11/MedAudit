using DentalClinic.Application.Identity.Models;

namespace DentalClinic.Application.Identity;

public interface IInvitationService
{
    Task<InvitationPreview> InspectAsync(string token, CancellationToken cancellationToken);
    Task<bool> AcceptAsync(AcceptInvitationCommand command, CancellationToken cancellationToken);
}
