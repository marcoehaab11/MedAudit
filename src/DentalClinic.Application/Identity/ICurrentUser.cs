namespace DentalClinic.Application.Identity;

public interface ICurrentUser
{
    Guid? UserId { get; }
}
