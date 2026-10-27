using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using DentalClinic.Api.Endpoints;
using DentalClinic.Api.Extensions;
using DentalClinic.Application;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace DentalClinic.IntegrationTests;

// Real HTTP cookie handling, production endpoints and production database validation.
// The ticket cache is in-memory for these tests; Redis adapter tests are separate.
public sealed class VerifiedSessionTests : IAsyncLifetime
{
    private WebApplication app = null!;
    private HttpClient client = null!;
    private PostgreSqlContainer? postgres;
    private Guid tenantId;
    private Guid memberId;
    private Guid adminId;
    private Guid roleId;

    public async Task InitializeAsync()
    {
        var connection = Environment.GetEnvironmentVariable("AUTH_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connection))
        {
            postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await postgres.StartAsync();
            connection = postgres.GetConnectionString();
        }
        connection = new NpgsqlConnectionStringBuilder(connection) { Database = "session_test_" + Guid.NewGuid().ToString("N"), Pooling = false }.ConnectionString;
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Postgres"] = connection, ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false" });
        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration);
        builder.Services.RemoveAll<IDistributedCache>();
        builder.Services.AddDistributedMemoryCache();
        builder.Services.AddApiAuthentication(builder.Configuration);
        builder.Services.AddApiAuthorization();
        builder.Services.AddAuthentication().AddIdentityCookies();
        builder.Services.AddVerifiedSessions(IdentityConstants.ApplicationScheme);
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "Planora.Admin.Session";
            options.EventsType = typeof(VerifiedSessionEvents);
        });
        app = builder.Build();
        app.UseRouting();
        app.UseMiddleware<SessionSecurityMiddleware>();
        app.UseAuthentication();
        app.UseMiddleware<TenantResolutionMiddleware>();
        app.UseAuthorization();
        app.MapIdentityEndpoints();
        app.MapPublicBookingEndpoints();
        app.MapGet("/private", (HttpContext context) => Results.Json(new
        { userId = context.User.FindFirstValue("sub"), roles = context.User.FindAll(ClaimTypes.Role).Select(x => x.Value) }));
        app.MapGet("/forgotten", () => "Must be private by default");
        app.MapGet("/public", () => "Public").AllowAnonymous();
        app.MapPost("/api/private", () => "Changed");
        app.MapGet("/admin", () => "Admin private data").RequireAuthorization(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder(IdentityConstants.ApplicationScheme)
            .RequireAuthenticatedUser().RequireRole(AuthConstants.PlatformAdminRole).Build());
        app.MapPost("/test/admin-login", async (HttpContext context, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn) =>
        {
            var account = await users.FindByIdAsync(adminId.ToString());
            await signIn.SignInWithClaimsAsync(account!, new AuthenticationProperties { ExpiresUtc = DateTimeOffset.UtcNow.AddHours(1) },
                [new Claim(ClaimTypes.Role, AuthConstants.PlatformAdminRole), new Claim(VerifiedSessionEvents.IdentityClaim, adminId.ToString()), new Claim(VerifiedSessionEvents.StampClaim, account!.SecurityStamp!)]);
            return Results.NoContent();
        }).AllowAnonymous();
        await app.StartAsync();
        client = app.GetTestClient();
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.EnsureCreatedAsync();
        var now = DateTimeOffset.UtcNow.AddMinutes(-1);
        var clinic = new Tenant("Session Clinic", "session-clinic", "01000000000", "clinic@example.invalid", "Street", "Cairo", "Egypt", "UTC", "EGP", now, subscriptionMonths: 12);
        tenantId = clinic.Id;
        db.Tenants.Add(clinic);
        await db.SaveChangesAsync();
        scope.ServiceProvider.GetRequiredService<CurrentTenant>().Set(tenantId);
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        memberId = Guid.NewGuid();
        var member = new ApplicationUser { Id = memberId, Email = "member@example.invalid", UserName = "member@example.invalid", EmailConfirmed = true, LockoutEnabled = true };
        Assert.True((await users.CreateAsync(member, "Password123!")).Succeeded);
        db.ClinicUsers.Add(new ClinicUser(memberId, tenantId, "Real Member", null, UserStatus.Active, now));
        var role = new TenantRole(tenantId, "Receptionist", "Test role", true, now);
        roleId = role.Id;
        db.TenantRoles.Add(role);
        db.UserRoleAssignments.Add(new UserRoleAssignment(tenantId, memberId, role.Id, now));
        db.RolePermissions.Add(new RolePermissionGrant(tenantId, role.Id, Permissions.PatientsView));
        await db.SaveChangesAsync();
        adminId = Guid.NewGuid();
        Assert.True((await users.CreateAsync(new ApplicationUser { Id = adminId, Email = "admin@example.invalid", UserName = "admin@example.invalid", IsPlatformAdmin = true, EmailConfirmed = true }, "Password123!")).Succeeded);
    }

    public async Task DisposeAsync()
    {
        client?.Dispose();
        if (app is not null) await app.DisposeAsync();
        if (postgres is not null) await postgres.DisposeAsync();
    }

    [Fact]
    public async Task SignOutRevokesCopiedCookieAndPrivatePagesRequireLogin()
    {
        var cookie = await LoginAsync();
        Assert.Equal(HttpStatusCode.OK, (await GetAsync("/private", cookie)).StatusCode);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        request.Headers.Add("Cookie", cookie); request.Headers.Add("X-App-Request", "1");
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAsync("/private", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/forgotten")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/public")).StatusCode);
    }

    [Fact]
    public async Task BrowserUserIdAndRoleCannotReplaceVerifiedIdentity()
    {
        var cookie = await LoginAsync();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/private?userId=" + adminId + "&role=PlatformAdmin");
        request.Headers.Add("Cookie", cookie + "; user_id=" + adminId + "; role=PlatformAdmin");
        request.Headers.Add("X-User-Id", adminId.ToString());
        var result = await client.SendAsync(request);
        var body = await result.Content.ReadAsStringAsync();
        Assert.Contains(memberId.ToString(), body);
        Assert.DoesNotContain(adminId.ToString(), body);
        Assert.DoesNotContain("PlatformAdmin", body);
    }

    [Fact]
    public async Task OrdinaryUserCannotReadAdminAndOldBearerTokensAreRejected()
    {
        var response = await GetAsync("/admin", await LoginAsync());
        Assert.DoesNotContain("Admin private data", await response.Content.ReadAsStringAsync());
        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
        using var forged = new HttpRequestMessage(HttpMethod.Get, "/private");
        forged.Headers.Add("Authorization", "Bearer browser-controlled-value");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(forged)).StatusCode);
    }

    [Fact]
    public async Task RemovingAdminFlagRevokesExistingAdminAccessImmediately()
    {
        var response = await client.PostAsync("/test/admin-login", null);
        var cookie = Cookie(response, "Planora.Admin.Session");
        Assert.Equal(HttpStatusCode.OK, (await GetAsync("/admin", cookie)).StatusCode);
        await using (var scope = app.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.Where(x => x.Id == adminId)
                .ExecuteUpdateAsync(x => x.SetProperty(u => u.IsPlatformAdmin, false));
        Assert.NotEqual(HttpStatusCode.OK, (await GetAsync("/admin", cookie)).StatusCode);
    }

    [Fact]
    public async Task PasswordSecurityStampChangeRejectsExistingSession()
    {
        var cookie = await LoginAsync();
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var account = await users.FindByIdAsync(memberId.ToString());
            Assert.True((await users.UpdateSecurityStampAsync(account!)).Succeeded);
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAsync("/private", cookie)).StatusCode);
    }

    [Fact]
    public async Task PermissionChangesComeFromDatabaseWithoutRelogin()
    {
        var cookie = await LoginAsync();
        Assert.Contains(Permissions.PatientsView, await (await GetAsync("/api/auth/permissions", cookie)).Content.ReadAsStringAsync());
        await using (var scope = app.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().RolePermissions.IgnoreQueryFilters().Where(x => x.RoleId == roleId).ExecuteDeleteAsync();
        Assert.DoesNotContain(Permissions.PatientsView, await (await GetAsync("/api/auth/permissions", cookie)).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ExpiredSubscriptionRejectsExistingSession()
    {
        var cookie = await LoginAsync();
        await using (var scope = app.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Tenants.Where(x => x.Id == tenantId)
                .ExecuteUpdateAsync(x => x.SetProperty(t => t.SubscriptionExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await GetAsync("/private", cookie)).StatusCode);
    }

    [Fact]
    public async Task CrossSiteWriteWithoutRequestHeaderIsRejected()
    {
        var cookie = await LoginAsync();
        using var blocked = new HttpRequestMessage(HttpMethod.Post, "/api/private");
        blocked.Headers.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(blocked)).StatusCode);
        using var allowed = new HttpRequestMessage(HttpMethod.Post, "/api/private");
        allowed.Headers.Add("Cookie", cookie); allowed.Headers.Add("X-App-Request", "1");
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(allowed)).StatusCode);
    }

    [Fact]
    public async Task BookingReferenceWithoutManagementSecretDoesNotDisclosePatient()
    {
        var response = await client.GetAsync("/api/public/bookings/confirmation/BK-REFERENCE");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("patientPhone", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PrivatePagePermissionChecksRejectBrowserSelectedAdminPage()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/page-access");
        request.Headers.Add("Cookie", await LoginAsync()); request.Headers.Add("X-Original-URI", "/users");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(request)).StatusCode);
    }

    private async Task<string> LoginAsync()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        { Content = JsonContent.Create(new { email = "member@example.invalid", password = "Password123!" }) };
        request.Headers.Add("X-App-Request", "1");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("accessToken", await response.Content.ReadAsStringAsync());
        Assert.Contains("httponly", string.Join(";", response.Headers.GetValues("Set-Cookie")), StringComparison.OrdinalIgnoreCase);
        return Cookie(response, "Planora.Clinic.Session");
    }

    private async Task<HttpResponseMessage> GetAsync(string path, string cookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("Cookie", cookie);
        return await client.SendAsync(request);
    }

    private static string Cookie(HttpResponseMessage response, string name) => response.Headers.GetValues("Set-Cookie")
        .Select(x => x.Split(';')[0]).Last(x => x.StartsWith(name + "=", StringComparison.Ordinal) && x != name + "=");
}
