using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace DentalClinic.IntegrationTests;

[Collection(PlatformDatabaseFixtureGroup.Name)]
public sealed class PatientWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task PatientsAreInvisibleAcrossTenantBoundaries()
    {
        await using var test = await CreateContextAsync();
        var alpha = await CreateClinicAsync(test, "patient-alpha", "admin@patient-alpha.example");
        var beta = await CreateClinicAsync(test, "patient-beta", "admin@patient-beta.example");
        await AcceptAsync(test, "admin@patient-alpha.example");
        await AcceptAsync(test, "admin@patient-beta.example");
        SetActor(test, alpha);
        var patientId = await CreatePatientAsync(test, "Mona", "Hassan");

        SetActor(test, beta);
        await using var scope = test.Provider.CreateAsyncScope();
        var queries = scope.ServiceProvider.GetRequiredService<IPatientQueries>();

        Assert.Null(await queries.GetAsync(patientId, CancellationToken.None));
        Assert.Empty((await queries.SearchAsync(new PatientSearchQuery(), CancellationToken.None)).Items);
    }

    [Fact]
    public async Task ConcurrentCreationProducesUniqueMonotonicTenantNumbers()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "numbers", "admin@numbers.example");
        await AcceptAsync(test, "admin@numbers.example");
        SetActor(test, clinic);

        await Task.WhenAll(Enumerable.Range(1, 12).Select(async index =>
        {
            await using var scope = test.Provider.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<IPatientCommands>().CreateAsync(
                new CreatePatientCommand(Profile($"Patient{index}", "Concurrent")), CancellationToken.None);
        }));

        await using var db = CreateDbContext(test.ConnectionString);
        var numbers = await db.Patients.IgnoreQueryFilters().Where(x => x.TenantId == clinic.TenantId)
            .OrderBy(x => x.PatientNumber).Select(x => x.PatientNumber).ToListAsync();
        Assert.Equal(12, numbers.Count);
        Assert.Equal(12, numbers.Distinct().Count());
        Assert.Equal("NUM-000001", numbers[0]);
        Assert.Equal("NUM-000012", numbers[^1]);
    }

    [Fact]
    public async Task ArchiveRemovesPatientFromNormalSearchAndPreventsChanges()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "archive", "admin@archive.example");
        await AcceptAsync(test, "admin@archive.example");
        SetActor(test, clinic);
        var patientId = await CreatePatientAsync(test, "Omar", "Ali");

        await using var scope = test.Provider.CreateAsyncScope();
        var commands = scope.ServiceProvider.GetRequiredService<IPatientCommands>();
        Assert.True(await commands.ArchiveAsync(patientId, CancellationToken.None));
        var visible = await scope.ServiceProvider.GetRequiredService<IPatientQueries>()
            .SearchAsync(new PatientSearchQuery(), CancellationToken.None);

        Assert.Empty(visible.Items);
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => commands.UpdateAsync(
            new UpdatePatientCommand(patientId, Profile("Changed", "Name")), CancellationToken.None));
    }

    [Fact]
    public async Task UserWithoutPatientPermissionIsDenied()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "denied", "admin@denied.example");
        await AcceptAsync(test, "admin@denied.example");
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = Guid.NewGuid();
        await using var scope = test.Provider.CreateAsyncScope();

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            scope.ServiceProvider.GetRequiredService<IPatientQueries>()
                .SearchAsync(new PatientSearchQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task ReceptionistCannotSeeMedicalHistoryWhileDoctorCanManageIt()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "medical", "admin@medical.example");
        await AcceptAsync(test, "admin@medical.example");
        SetActor(test, clinic);
        var patientId = await CreatePatientAsync(test, "Salma", "Adel");
        Guid receptionistId;
        Guid doctorId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var roles = await users.GetRolesAsync(CancellationToken.None);
            receptionistId = await users.InviteUserAsync(new InviteUserCommand("Reception", "reception@medical.example", null,
                [roles.Single(x => x.Name == SystemRoleDefinitions.Receptionist).Id]), CancellationToken.None);
            doctorId = await users.InviteUserAsync(new InviteUserCommand("Doctor", "doctor@medical.example", null,
                [roles.Single(x => x.Name == SystemRoleDefinitions.Doctor).Id]), CancellationToken.None);
        }
        await AcceptAsync(test, "reception@medical.example");
        await AcceptAsync(test, "doctor@medical.example");

        test.Tenant.Set(clinic.TenantId); test.User.UserId = receptionistId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var details = await scope.ServiceProvider.GetRequiredService<IPatientQueries>()
                .GetAsync(patientId, CancellationToken.None);
            Assert.NotNull(details);
            Assert.False(details.CanViewMedicalInformation);
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
                .GetRequiredService<IPatientMedicalCommands>()
                .AddAllergyAsync(patientId, new MedicalTextCommand("Latex", null), CancellationToken.None));
        }

        test.User.UserId = doctorId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.NotNull(await scope.ServiceProvider.GetRequiredService<IPatientMedicalCommands>()
                .AddAllergyAsync(patientId, new MedicalTextCommand("Latex", "Confirmed"), CancellationToken.None));
        }
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var details = await scope.ServiceProvider.GetRequiredService<IPatientQueries>()
                .GetAsync(patientId, CancellationToken.None);
            Assert.True(details!.CanViewMedicalInformation);
            Assert.Equal("Latex", Assert.Single(details.Allergies).Name);
        }
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        { Database = $"patients_{Guid.NewGuid():N}", Pooling = false };
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

    private static async Task<Guid> CreatePatientAsync(TestContext test, string first, string last)
    {
        await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPatientCommands>()
            .CreateAsync(new CreatePatientCommand(Profile(first, last)), CancellationToken.None);
    }

    private static PatientProfileInput Profile(string first, string last) => new(
        first, null, last, PatientGender.Female, new DateOnly(1990, 1, 1), "+20 100", null,
        $"{first.ToLowerInvariant()}@example.com", null, "Cairo", "Egypt", null, null, null, null, null, null);

    private static ApplicationDbContext CreateDbContext(string connectionString) => new(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connectionString).Options,
        new MutableTenant(), new PlatformWriteScope());

    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User,
        CapturingNotifier Notifier, string ConnectionString) : IAsyncDisposable
    { public ValueTask DisposeAsync() => Provider.DisposeAsync(); }
    private sealed class MutableTenant : ICurrentTenant
    { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "patient-integration"; }
    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    { private readonly Dictionary<string, string> tokens = new(StringComparer.OrdinalIgnoreCase); public string TokenFor(string email) => tokens[email]; public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) { tokens[email] = token; return Task.CompletedTask; } }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
}
