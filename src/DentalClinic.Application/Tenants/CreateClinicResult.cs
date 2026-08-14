namespace DentalClinic.Application.Tenants;

public sealed record CreateClinicResult(Guid TenantId, Guid AdminUserId, Guid InvitationId);
