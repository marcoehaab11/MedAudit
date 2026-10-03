namespace DentalClinic.Application.Identity;

public sealed record CreateUserCommand(string DisplayName, string Email, string Password, string? Phone, IReadOnlyCollection<Guid> RoleIds, IReadOnlyCollection<string>? Permissions = null);
public sealed record InviteUserCommand(string DisplayName, string Email, string? Phone, IReadOnlyCollection<Guid> RoleIds, IReadOnlyCollection<string>? Permissions = null);
public sealed record UpdateUserCommand(Guid Id, string DisplayName, string? Phone);
public sealed record AssignUserRolesCommand(Guid UserId, IReadOnlyCollection<Guid> RoleIds);
public sealed record SetUserPermissionsCommand(Guid UserId, IReadOnlyCollection<string>? Permissions);
public sealed record CreateRoleCommand(string Name, string Description, IReadOnlyCollection<string> Permissions);
public sealed record UpdateRoleCommand(Guid RoleId, string Name, string Description);
public sealed record UpdateRolePermissionsCommand(Guid RoleId, IReadOnlyCollection<string> Permissions);
public sealed record AcceptInvitationCommand(string Token, string Password, string ConfirmPassword);
public sealed record LoginCommand(string Email, string Password);
