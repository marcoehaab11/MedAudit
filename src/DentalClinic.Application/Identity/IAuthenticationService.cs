using DentalClinic.Application.Identity.Models;

namespace DentalClinic.Application.Identity;

public interface IAuthenticationService
{
    Task<LoginResult?> LoginAsync(LoginCommand command, CancellationToken cancellationToken);
}
