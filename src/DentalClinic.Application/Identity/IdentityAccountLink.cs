namespace DentalClinic.Application.Identity;

public sealed record IdentityAccountLink(Guid MembershipId, Guid IdentityUserId, bool ExistingAccount);
