namespace DentalClinic.Application.Identity;

public interface IAccessTokenIssuer
{
    (string Token, DateTimeOffset ExpiresAt) Issue(
        Guid userId,
        Guid tenantId,
        string displayName,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions);
}
