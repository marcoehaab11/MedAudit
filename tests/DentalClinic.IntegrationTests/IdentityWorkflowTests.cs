using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class IdentityWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TenantAdminSeesAndChangesOnlyItsOwnTenantUsers()
    {
        await using var test = await CreateContextAsync();
        var tenantA = await CreateClinicAsync(test, "alpha", "admin@alpha.example");
        var tenantB = await CreateClinicAsync(test, "beta", "admin@beta.example");
        await AcceptAsync(test, "admin@alpha.example");
        await AcceptAsync(test, "admin@beta.example");
        test.Tenant.Set(tenantA.TenantId);
        test.User.UserId = tenantA.AdminUserId;

        await using var scope = test.Provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
        var visible = await users.SearchUsersAsync(new UserSearchQuery(), CancellationToken.None);

        Assert.Equal(tenantA.AdminUserId, Assert.Single(visible.Items).Id);
        Assert.Null(await users.GetUserAsync(tenantB.AdminUserId, CancellationToken.None));
        Assert.False(await users.UpdateUserAsync(
            new UpdateUserCommand(tenantB.AdminUserId, "Cross tenant", null), CancellationToken.None));
    }

    [Fact]
    public async Task TenantAdminCannotAssignAnotherTenantRoleOrModifySelf()
    {
        await using var test = await CreateContextAsync();
        var tenantA = await CreateClinicAsync(test, "alpha-role", "owner@alpha-role.example");
        var tenantB = await CreateClinicAsync(test, "beta-role", "owner@beta-role.example");
        await AcceptAsync(test, "owner@alpha-role.example");
        test.Tenant.Set(tenantA.TenantId);
        test.User.UserId = tenantA.AdminUserId;

        Guid tenantBRole;
        await using (var db = CreateDbContext(test.ConnectionString))
        {
            tenantBRole = await db.TenantRoles.IgnoreQueryFilters()
                .Where(x => x.TenantId == tenantB.TenantId && x.NormalizedName == "DOCTOR")
                .Select(x => x.Id).SingleAsync();
        }

        await using var scope = test.Provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => users.AssignRolesAsync(
            new AssignUserRolesCommand(tenantA.AdminUserId, [tenantBRole]), CancellationToken.None));
        var roles = await users.GetRolesAsync(CancellationToken.None);
        Assert.DoesNotContain(roles, x => x.Name == "PlatformAdmin");
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => users.CreateRoleAsync(
            new CreateRoleCommand("PlatformAdmin", "Forbidden platform role", [Permissions.UsersView]),
            CancellationToken.None));
    }

    [Fact]
    public async Task DoctorAndReceptionistCannotManageUsers()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "least-privilege", "admin@least.example");
        await AcceptAsync(test, "admin@least.example");
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        Guid doctorId;
        Guid receptionistId;

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var roles = await service.GetRolesAsync(CancellationToken.None);
            doctorId = await service.InviteUserAsync(new InviteUserCommand(
                "Dr Noor", "doctor@least.example", null,
                [roles.Single(x => x.Name == SystemRoleDefinitions.Doctor).Id]), CancellationToken.None);
            receptionistId = await service.InviteUserAsync(new InviteUserCommand(
                "Front Desk", "reception@least.example", null,
                [roles.Single(x => x.Name == SystemRoleDefinitions.Receptionist).Id]), CancellationToken.None);
        }

        await AcceptAsync(test, "doctor@least.example");
        await AcceptAsync(test, "reception@least.example");
        foreach (var userId in new[] { doctorId, receptionistId })
        {
            test.Tenant.Set(clinic.TenantId);
            test.User.UserId = userId;
            await using var scope = test.Provider.CreateAsyncScope();
            var service = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                service.SearchUsersAsync(new UserSearchQuery(), CancellationToken.None));
        }
    }

    [Fact]
    public async Task InvitationActivatesOnlyItsAssociatedTenantAndCannotBeReused()
    {
        await using var test = await CreateContextAsync();
        var tenantA = await CreateClinicAsync(test, "invite-a", "admin@invite-a.example");
        var tenantB = await CreateClinicAsync(test, "invite-b", "admin@invite-b.example");
        test.Tenant.Clear();
        var command = new AcceptInvitationCommand(
            test.Notifier.TokenFor("admin@invite-a.example"),
            "A-strong-password-123!",
            "A-strong-password-123!");

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var invitations = scope.ServiceProvider.GetRequiredService<IInvitationService>();
            Assert.True(await invitations.AcceptAsync(command, CancellationToken.None));
            Assert.False(await invitations.AcceptAsync(command, CancellationToken.None));
        }

        await using var db = CreateDbContext(test.ConnectionString);
        Assert.Equal(UserStatus.Active, (await db.ClinicUsers.IgnoreQueryFilters()
            .SingleAsync(x => x.Id == tenantA.AdminUserId)).Status);
        Assert.Equal(UserStatus.Invited, (await db.ClinicUsers.IgnoreQueryFilters()
            .SingleAsync(x => x.Id == tenantB.AdminUserId)).Status);
    }

    [Fact]
    public async Task DeactivatedUserCannotAuthenticate()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "login-state", "admin@login-state.example");
        await AcceptAsync(test, "admin@login-state.example");
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        Guid invitedId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var service = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var role = (await service.GetRolesAsync(CancellationToken.None))
                .Single(x => x.Name == SystemRoleDefinitions.Receptionist);
            invitedId = await service.InviteUserAsync(new InviteUserCommand(
                "Reception", "login.user@example", null, [role.Id]), CancellationToken.None);
        }
        await AcceptAsync(test, "login.user@example");
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var auth = scope.ServiceProvider.GetRequiredService<IAuthenticationService>();
            Assert.NotNull(await auth.LoginAsync(
                new LoginCommand("login.user@example", "A-strong-password-123!"), CancellationToken.None));
        }

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.True(await scope.ServiceProvider.GetRequiredService<IUserManagementService>()
                .SetUserActiveAsync(invitedId, false, CancellationToken.None));
        }
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var auth = scope.ServiceProvider.GetRequiredService<IAuthenticationService>();
            Assert.Null(await auth.LoginAsync(
                new LoginCommand("login.user@example", "A-strong-password-123!"), CancellationToken.None));
        }
    }

    [Fact]
    public async Task PlatformInspectionUsesExplicitTenantWithoutSettingTenantContext()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "support", "admin@support.example");
        Assert.False(test.Tenant.IsAvailable);
        await using var scope = test.Provider.CreateAsyncScope();
        var result = await scope.ServiceProvider.GetRequiredService<IPlatformUserInspectionService>()
            .SearchAsync(clinic.TenantId, new UserSearchQuery(), CancellationToken.None);
        Assert.Equal(clinic.AdminUserId, Assert.Single(result.Items).Id);
        Assert.False(test.Tenant.IsAvailable);
    }

    [Fact]
    public async Task ClinicUserCannotUsePlatformUserInspection()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "no-support", "admin@no-support.example");
        test.PlatformAccess.IsPlatformAdmin = false;
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var scope = test.Provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            scope.ServiceProvider.GetRequiredService<IPlatformUserInspectionService>()
                .SearchAsync(clinic.TenantId, new UserSearchQuery(), CancellationToken.None));
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        {
            Database = $"identity_{Guid.NewGuid():N}",
            Pooling = false
        };
        var connectionString = builder.ConnectionString;
        await using (var db = CreateDbContext(connectionString)) await db.Database.EnsureCreatedAsync();
        var tenant = new MutableTenant();
        var user = new MutableUser();
        var notifier = new CapturingNotifier();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false"
        }).Build();
        var services = new ServiceCollection();
        services.AddLogging(); services.AddApplication(); services.AddInfrastructure(configuration);
        services.RemoveAll<IPlatformAccessContext>(); services.RemoveAll<ISystemClock>();
        services.RemoveAll<IClinicInvitationNotifier>(); services.RemoveAll<ICurrentTenant>();
        services.RemoveAll<ICurrentUser>();
        var platformAccess = new PlatformAccess();
        services.AddSingleton<IPlatformAccessContext>(platformAccess);
        services.AddSingleton<ISystemClock>(new FixedClock()); services.AddSingleton<IClinicInvitationNotifier>(notifier);
        services.AddSingleton<ICurrentTenant>(tenant); services.AddSingleton<ICurrentUser>(user);
        services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        return new TestContext(services.BuildServiceProvider(), tenant, user, platformAccess, notifier, connectionString);
    }

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IClinicManagementService>().CreateAsync(new CreateClinicCommand(
            $"Clinic {slug}", slug, "+20 1000", $"hello@{slug}.example", "1 Main Street", "Cairo", "Egypt", "Africa/Cairo", "EGP", email, null), CancellationToken.None);
    }

    private static async Task AcceptAsync(TestContext test, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<IInvitationService>().AcceptAsync(
            new AcceptInvitationCommand(test.Notifier.TokenFor(email), "A-strong-password-123!", "A-strong-password-123!"), CancellationToken.None));
    }

    private static ApplicationDbContext CreateDbContext(string connectionString) => new(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connectionString).Options,
        new MutableTenant(), new PlatformWriteScope());

    private sealed record TestContext(
        ServiceProvider Provider, MutableTenant Tenant, MutableUser User, PlatformAccess PlatformAccess,
        CapturingNotifier Notifier, string ConnectionString) : IAsyncDisposable
    {
        public ValueTask DisposeAsync() => Provider.DisposeAsync();
    }
    private sealed class MutableTenant : ICurrentTenant
    {
        public Guid? TenantId { get; private set; }
        public bool IsAvailable => TenantId.HasValue;
        public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException();
        public void Set(Guid tenantId) => TenantId = tenantId;
        public void Clear() => TenantId = null;
    }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext
    {
        public bool IsPlatformAdmin { get; set; } = true;
        public Guid? UserId => Guid.NewGuid();
        public string? CorrelationId => "identity-integration";
    }
    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    {
        private readonly Dictionary<string, string> tokens = new(StringComparer.OrdinalIgnoreCase);
        public string TokenFor(string email) => tokens[email];
        public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken)
        { tokens[email] = token; return Task.CompletedTask; }
    }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    {
        public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) =>
            ($"test-token-{userId:D}", Now.AddHours(1));
    }
}
