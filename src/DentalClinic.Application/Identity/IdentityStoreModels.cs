using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Identity;

public sealed record LoginAccount(
    Guid UserId,
    Guid TenantId,
    string DisplayName,
    UserStatus UserStatus,
    TenantStatus TenantStatus);

public sealed record InvitationAccount(
    AdminInvitation Invitation,
    ClinicUser User);
