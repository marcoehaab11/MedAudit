using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Identity.Models;

public sealed record UserSearchQuery(
    string? Search = null,
    Guid? RoleId = null,
    UserStatus? Status = null,
    int Page = 1,
    int PageSize = 20);

public sealed record UserListItem(
    Guid Id,
    string DisplayName,
    string Email,
    string? Phone,
    UserStatus Status,
    IReadOnlyCollection<string> Roles,
    DateTimeOffset CreatedAt);

public sealed record UserDetails(
    Guid Id,
    string DisplayName,
    string Email,
    string? Phone,
    UserStatus Status,
    IReadOnlyCollection<RoleSummary> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record RoleSummary(Guid Id, string Name, string Description, bool IsSystemRole);
public sealed record RoleDetails(
    Guid Id,
    string Name,
    string Description,
    bool IsSystemRole,
    IReadOnlyCollection<string> Permissions,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public enum InvitationPreviewState
{
    Invalid = 0,
    Pending = 1,
    Accepted = 2,
    Expired = 3,
    Cancelled = 4
}

public sealed record InvitationPreview(
    InvitationPreviewState Status,
    string? Email,
    string? Role,
    DateTimeOffset? ExpiresAt);

public sealed record LoginResult(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    Guid UserId,
    string DisplayName,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions);
