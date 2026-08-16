using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Contracts.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/api/auth").AllowAnonymous();
        auth.MapPost("/login", LoginAsync).RequireRateLimiting("auth-login");
        auth.MapPost("/invitations/inspect", InspectInvitationAsync).RequireRateLimiting("public-read");
        auth.MapPost("/invitations/accept", AcceptInvitationAsync).RequireRateLimiting("auth-login");

        var users = endpoints.MapGroup("/api/users")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy);
        users.MapGet("/", SearchUsersAsync).RequireAuthorization(Permissions.UsersView);
        users.MapGet("/{id:guid}", GetUserAsync).RequireAuthorization(Permissions.UsersView);
        users.MapPost("/invitations", InviteUserAsync).RequireAuthorization(Permissions.UsersCreate);
        users.MapPut("/{id:guid}", UpdateUserAsync).RequireAuthorization(Permissions.UsersEdit);
        users.MapPost("/{id:guid}/activate", ActivateUserAsync).RequireAuthorization(Permissions.UsersActivate);
        users.MapPost("/{id:guid}/deactivate", DeactivateUserAsync).RequireAuthorization(Permissions.UsersDeactivate);
        users.MapPut("/{id:guid}/roles", AssignRolesAsync).RequireAuthorization(Permissions.UsersManageRoles);

        var roles = endpoints.MapGroup("/api/roles")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy);
        roles.MapGet("/", GetRolesAsync).RequireAuthorization(Permissions.UsersView);
        roles.MapGet("/{id:guid}", GetRoleAsync).RequireAuthorization(Permissions.UsersView);
        roles.MapPost("/", CreateRoleAsync).RequireAuthorization(Permissions.UsersManageRoles);
        roles.MapPut("/{id:guid}", UpdateRoleAsync).RequireAuthorization(Permissions.UsersManageRoles);
        roles.MapPut("/{id:guid}/permissions", UpdateRolePermissionsAsync)
            .RequireAuthorization(Permissions.UsersManageRoles);
        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        IAuthenticationService service,
        CancellationToken cancellationToken)
    {
        var result = await service.LoginAsync(new LoginCommand(request.Email, request.Password), cancellationToken);
        return result is null
            ? Results.Json(new { message = "Invalid email or password." }, statusCode: StatusCodes.Status401Unauthorized)
            : Results.Ok(result);
    }

    private static Task<InvitationPreview> InspectInvitationAsync(
        InspectInvitationRequest request,
        IInvitationService service,
        CancellationToken cancellationToken) => service.InspectAsync(request.Token, cancellationToken);

    private static async Task<IResult> AcceptInvitationAsync(
        AcceptInvitationRequest request,
        IInvitationService service,
        CancellationToken cancellationToken) =>
        await service.AcceptAsync(
            new AcceptInvitationCommand(request.Token, request.Password, request.ConfirmPassword),
            cancellationToken)
            ? Results.Ok(new { activated = true })
            : Results.BadRequest(new { message = "The invitation cannot be accepted." });

    private static Task<PagedResult<UserListItem>> SearchUsersAsync(
        IUserManagementService service,
        string? search,
        Guid? roleId,
        UserStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        service.SearchUsersAsync(new UserSearchQuery(search, roleId, status, page, pageSize), cancellationToken);

    private static async Task<IResult> GetUserAsync(
        Guid id,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.GetUserAsync(id, cancellationToken) is { } user ? Results.Ok(user) : Results.NotFound();

    private static async Task<IResult> InviteUserAsync(
        InviteUserRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken)
    {
        var id = await service.InviteUserAsync(new InviteUserCommand(
            request.DisplayName, request.Email, request.Phone, request.RoleIds), cancellationToken);
        return Results.Created($"/api/users/{id:D}", new { id });
    }

    private static async Task<IResult> UpdateUserAsync(
        Guid id,
        UpdateUserRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.UpdateUserAsync(new UpdateUserCommand(id, request.DisplayName, request.Phone), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static Task<IResult> ActivateUserAsync(
        Guid id,
        IUserManagementService service,
        CancellationToken cancellationToken) => SetActiveAsync(id, true, service, cancellationToken);

    private static Task<IResult> DeactivateUserAsync(
        Guid id,
        IUserManagementService service,
        CancellationToken cancellationToken) => SetActiveAsync(id, false, service, cancellationToken);

    private static async Task<IResult> SetActiveAsync(
        Guid id,
        bool active,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.SetUserActiveAsync(id, active, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> AssignRolesAsync(
        Guid id,
        AssignUserRolesRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.AssignRolesAsync(new AssignUserRolesCommand(id, request.RoleIds), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IReadOnlyCollection<RoleSummary>> GetRolesAsync(
        IUserManagementService service,
        CancellationToken cancellationToken) => await service.GetRolesAsync(cancellationToken);

    private static async Task<IResult> GetRoleAsync(
        Guid id,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.GetRoleAsync(id, cancellationToken) is { } role ? Results.Ok(role) : Results.NotFound();

    private static async Task<IResult> CreateRoleAsync(
        CreateRoleRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken)
    {
        var id = await service.CreateRoleAsync(
            new CreateRoleCommand(request.Name, request.Description, request.Permissions), cancellationToken);
        return Results.Created($"/api/roles/{id:D}", new { id });
    }

    private static async Task<IResult> UpdateRolePermissionsAsync(
        Guid id,
        UpdateRolePermissionsRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.UpdateRolePermissionsAsync(
            new UpdateRolePermissionsCommand(id, request.Permissions), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> UpdateRoleAsync(
        Guid id,
        UpdateRoleRequest request,
        IUserManagementService service,
        CancellationToken cancellationToken) =>
        await service.UpdateRoleAsync(new UpdateRoleCommand(id, request.Name, request.Description), cancellationToken)
            ? Results.NoContent() : Results.NotFound();
}
