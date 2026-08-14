using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Doctors;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class DoctorWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task DoctorProfileRequiresTenantDoctorAndIsInvisibleAcrossTenants()
    {
        await using var test = await CreateContextAsync();
        var alpha = await CreateClinicAsync(test, "doctor-alpha", "admin@doctor-alpha.example");
        var beta = await CreateClinicAsync(test, "doctor-beta", "admin@doctor-beta.example");
        await AcceptAsync(test, "admin@doctor-alpha.example");
        await AcceptAsync(test, "admin@doctor-beta.example");
        SetActor(test, alpha);
        var doctorUserId = await InviteDoctorAsync(test, "doctor@doctor-alpha.example");
        await AcceptAsync(test, "doctor@doctor-alpha.example");
        SetActor(test, alpha);
        var profileId = await CreateProfileAsync(test, doctorUserId, "ALPHA-001");

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            await Assert.ThrowsAsync<ValidationException>(() => CreateProfileAsync(
                scope.ServiceProvider, doctorUserId, "ALPHA-002"));
        }

        SetActor(test, beta);
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var queries = scope.ServiceProvider.GetRequiredService<IDoctorProfileQueries>();
            Assert.Null(await queries.GetAsync(profileId, CancellationToken.None));
            Assert.Empty((await queries.SearchAsync(new DoctorSearchQuery(), CancellationToken.None)).Items);
            await Assert.ThrowsAsync<ValidationException>(() => CreateProfileAsync(
                scope.ServiceProvider, doctorUserId, "BETA-001"));
        }
    }

    [Fact]
    public async Task ClinicAdminManagesScheduleAndAppendOnlyCompensationHistory()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "doctor-rules", "admin@doctor-rules.example");
        await AcceptAsync(test, "admin@doctor-rules.example");
        SetActor(test, clinic);
        var doctorUserId = await InviteDoctorAsync(test, "doctor@doctor-rules.example");
        await AcceptAsync(test, "doctor@doctor-rules.example");
        SetActor(test, clinic);
        var profileId = await CreateProfileAsync(test, doctorUserId, "RULE-001");

        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var schedules = scope.ServiceProvider.GetRequiredService<IDoctorScheduleService>();
            Assert.True(await schedules.SetAsync(profileId,
            [
                new SchedulePeriodInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0), 30,
                    [new ScheduleBreakInput(new TimeOnly(13, 0), new TimeOnly(13, 30))])
            ], CancellationToken.None));
            var persisted = Assert.Single((await schedules.GetAsync(profileId, CancellationToken.None))!);
            Assert.Equal(30, persisted.SlotDurationMinutes);
            Assert.Single(persisted.Breaks);

            await Assert.ThrowsAsync<ValidationException>(() => schedules.SetAsync(profileId,
            [
                new SchedulePeriodInput(DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(12, 0), 30, []),
                new SchedulePeriodInput(DayOfWeek.Tuesday, new TimeOnly(11, 0), new TimeOnly(14, 0), 30, [])
            ], CancellationToken.None));

            var compensation = scope.ServiceProvider.GetRequiredService<IDoctorCompensationService>();
            Assert.NotNull(await compensation.CreateAsync(new CreateDoctorCompensationCommand(profileId,
                new DoctorCompensationInput(CompensationType.FixedSalary, 10_000, null,
                    new DateOnly(2026, 1, 1), null)), CancellationToken.None));
            Assert.NotNull(await compensation.UpdateAsync(new UpdateDoctorCompensationCommand(profileId,
                new DoctorCompensationInput(CompensationType.FixedSalaryAndPercentage, 12_000, 10,
                    new DateOnly(2026, 7, 1), null)), CancellationToken.None));
            var history = (await compensation.GetHistoryAsync(profileId, CancellationToken.None))!.ToArray();
            Assert.Equal(2, history.Length);
            Assert.Equal(new DateOnly(2026, 6, 30), history.Single(x => x.EffectiveFrom.Year == 2026 && x.EffectiveFrom.Month == 1).EffectiveTo);
            Assert.Equal(12_000, history.Single(x => x.EffectiveFrom.Month == 7).FixedAmount);
        }

        test.User.UserId = doctorUserId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.NotNull(await scope.ServiceProvider.GetRequiredService<IDoctorScheduleService>()
                .GetAsync(profileId, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
                .GetRequiredService<IDoctorScheduleService>().SetAsync(profileId, [], CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
                .GetRequiredService<IDoctorCompensationService>().GetHistoryAsync(profileId, CancellationToken.None));
        }
    }

    [Fact]
    public async Task UserWithoutDoctorPermissionsCannotListOrManageDoctors()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "doctor-denied", "admin@doctor-denied.example");
        await AcceptAsync(test, "admin@doctor-denied.example");
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = Guid.NewGuid();

        await using var scope = test.Provider.CreateAsyncScope();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
            .GetRequiredService<IDoctorProfileQueries>().SearchAsync(new DoctorSearchQuery(), CancellationToken.None));
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
            .GetRequiredService<IDoctorProfileCommands>().CreateAsync(new CreateDoctorProfileCommand(
                Guid.NewGuid(), Profile("DENIED-001")), CancellationToken.None));
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        { Database = $"doctors_{Guid.NewGuid():N}", Pooling = false };
        var connectionString = builder.ConnectionString;
        await using (var db = CreateDbContext(connectionString)) await db.Database.EnsureCreatedAsync();
        var tenant = new MutableTenant(); var user = new MutableUser(); var notifier = new CapturingNotifier();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Postgres"] = connectionString, ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false" }).Build();
        var services = new ServiceCollection(); services.AddLogging(); services.AddApplication(); services.AddInfrastructure(configuration);
        services.RemoveAll<IPlatformAccessContext>(); services.RemoveAll<ISystemClock>(); services.RemoveAll<IClinicInvitationNotifier>();
        services.RemoveAll<ICurrentTenant>(); services.RemoveAll<ICurrentUser>();
        services.AddSingleton<IPlatformAccessContext>(new PlatformAccess()); services.AddSingleton<ISystemClock>(new FixedClock());
        services.AddSingleton<IClinicInvitationNotifier>(notifier); services.AddSingleton<ICurrentTenant>(tenant);
        services.AddSingleton<ICurrentUser>(user); services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        return new TestContext(services.BuildServiceProvider(), tenant, user, notifier, connectionString);
    }

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IClinicManagementService>().CreateAsync(new CreateClinicCommand(
            $"Clinic {slug}", slug, "+20 1000", $"hello@{slug}.example", "1 Main Street", "Cairo", "Egypt",
            "Africa/Cairo", "EGP", email, null), CancellationToken.None);
    }

    private static async Task<Guid> InviteDoctorAsync(TestContext test, string email)
    {
        await using var scope = test.Provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
        var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == SystemRoleDefinitions.Doctor);
        return await users.InviteUserAsync(new InviteUserCommand("Doctor", email, null, [role.Id]), CancellationToken.None);
    }

    private static async Task AcceptAsync(TestContext test, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<IInvitationService>().AcceptAsync(
            new AcceptInvitationCommand(test.Notifier.TokenFor(email), "A-strong-password-123!", "A-strong-password-123!"),
            CancellationToken.None));
    }

    private static void SetActor(TestContext test, CreateClinicResult clinic)
    { test.Tenant.Set(clinic.TenantId); test.User.UserId = clinic.AdminUserId; }

    private static Task<Guid> CreateProfileAsync(TestContext test, Guid userId, string license) =>
        CreateProfileAsync(test.Provider, userId, license);

    private static async Task<Guid> CreateProfileAsync(IServiceProvider provider, Guid userId, string license)
    {
        await using var scope = provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IDoctorProfileCommands>().CreateAsync(
            new CreateDoctorProfileCommand(userId, Profile(license)), CancellationToken.None);
    }

    private static DoctorProfileInput Profile(string license) =>
        new("General dentistry", license, "Profile biography", 30);

    private static ApplicationDbContext CreateDbContext(string connectionString) => new(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connectionString).Options,
        new MutableTenant(), new PlatformWriteScope());

    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User,
        CapturingNotifier Notifier, string ConnectionString) : IAsyncDisposable
    { public ValueTask DisposeAsync() => Provider.DisposeAsync(); }
    private sealed class MutableTenant : ICurrentTenant
    { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "doctor-integration"; }
    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    { private readonly Dictionary<string, string> tokens = new(StringComparer.OrdinalIgnoreCase); public string TokenFor(string email) => tokens[email]; public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) { tokens[email] = token; return Task.CompletedTask; } }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
}
