namespace DentalClinic.Contracts.Identity;

public sealed record LoginRequest(string Email, string Password);
public sealed record AcceptInvitationRequest(string Token, string Password, string ConfirmPassword);
public sealed record InspectInvitationRequest(string Token);
public sealed record InviteUserRequest(
    string DisplayName,
    string Email,
    string? Phone,
    IReadOnlyCollection<Guid> RoleIds);
public sealed record UpdateUserRequest(string DisplayName, string? Phone);
public sealed record AssignUserRolesRequest(IReadOnlyCollection<Guid> RoleIds);
public sealed record CreateRoleRequest(
    string Name,
    string Description,
    IReadOnlyCollection<string> Permissions);
public sealed record UpdateRoleRequest(string Name, string Description);
public sealed record UpdateRolePermissionsRequest(IReadOnlyCollection<string> Permissions);
