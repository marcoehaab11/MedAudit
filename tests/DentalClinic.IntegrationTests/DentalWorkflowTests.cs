using DentalClinic.Application;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Dental;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Identity;
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
public sealed partial class DentalWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 17, 6, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Monday = new(2026, 8, 17);

    [Fact]
    public async Task ExaminationPersistsClinicalRecordsSurfacesCanalsAndHistory()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "dental-flow", "admin@dental-flow.example");
        await AcceptAsync(test, "admin@dental-flow.example"); SetActor(test, clinic);
        var appointment = await CreateStartedAppointmentAsync(test, clinic, "Mona", "Dental", "DF-1");
        await using var scope = test.Provider.CreateAsyncScope();
        var commands = scope.ServiceProvider.GetRequiredService<IExaminationCommands>();
        var id = await commands.CreateAsync(appointment.Id, CancellationToken.None);
        var query = scope.ServiceProvider.GetRequiredService<IDentalQueries>();
        var examination = (await query.GetExaminationAsync(id, CancellationToken.None))!;
        Assert.True(await commands.AddFindingAsync(id, new(36, DentalFindingType.Caries,
            [ToothSurface.Mesial, ToothSurface.Occlusal], "finding detail"), examination.Version, CancellationToken.None));
        examination = (await query.GetExaminationAsync(id, CancellationToken.None))!;
        Assert.True(await commands.AddProcedureAsync(id, new(36, DentalProcedureType.Filling,
            [ToothSurface.Mesial, ToothSurface.Occlusal], "procedure detail"), examination.Version, CancellationToken.None));
        examination = (await query.GetExaminationAsync(id, CancellationToken.None))!;
        Assert.True(await commands.AddEndodonticAsync(id, new(36, "endo detail",
            [new EndodonticCanalInput("MB", 21m, null), new EndodonticCanalInput("D", 19m, "canal detail")]),
            examination.Version, CancellationToken.None));
        examination = (await query.GetExaminationAsync(id, CancellationToken.None))!;
        Assert.Equal(2, examination.Findings.Single().Surfaces.Count);
        Assert.Equal(2, examination.Procedures.Single().Surfaces.Count);
        Assert.Equal(2, examination.EndodonticRecords.Single().Canals.Count);
        Assert.True(await commands.CompleteAsync(id, examination.Version, CancellationToken.None));
        var chart = (await query.GetChartAsync(appointment.PatientId, CancellationToken.None))!;
        var tooth = chart.Teeth.Single(x => x.ToothNumber == 36);
        Assert.Contains(DentalFindingType.Caries, tooth.Findings);
        Assert.Contains(DentalProcedureType.Filling, tooth.Procedures);
        Assert.True(tooth.HasEndodonticRecord); Assert.Single(chart.RecentExaminations);
        var completed = (await query.GetExaminationAsync(id, CancellationToken.None))!;
        await Assert.ThrowsAsync<DentalStateException>(() => commands.UpdateNotesAsync(id, "rewrite", completed.Version, CancellationToken.None));
        await using var database = CreateDbContext(test.ConnectionString, clinic.TenantId);
        await Assert.ThrowsAsync<PostgresException>(() => database.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE examinations SET \"Notes\" = 'rewrite' WHERE \"Id\" = {id}"));
    }

    [Fact]
    public async Task TenantFiltersAndCompositeForeignKeysRejectCrossTenantClinicalData()
    {
        await using var test = await CreateContextAsync();
        var alpha = await CreateClinicAsync(test, "dental-alpha", "admin@dental-alpha.example");
        var beta = await CreateClinicAsync(test, "dental-beta", "admin@dental-beta.example");
        await AcceptAsync(test, "admin@dental-alpha.example"); await AcceptAsync(test, "admin@dental-beta.example");
        SetActor(test, alpha);
        var appointment = await CreateStartedAppointmentAsync(test, alpha, "Alpha", "Patient", "DA-1");
        Guid examinationId;
        await using (var scope = test.Provider.CreateAsyncScope())
            examinationId = await scope.ServiceProvider.GetRequiredService<IExaminationCommands>().CreateAsync(appointment.Id, CancellationToken.None);
        SetActor(test, beta);
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.Null(await scope.ServiceProvider.GetRequiredService<IDentalQueries>().GetExaminationAsync(examinationId, CancellationToken.None));
            await Assert.ThrowsAsync<DentalNotFoundException>(() => scope.ServiceProvider.GetRequiredService<IExaminationCommands>()
                .CreateAsync(appointment.Id, CancellationToken.None));
            Assert.Null(await scope.ServiceProvider.GetRequiredService<IDentalQueries>().GetChartAsync(appointment.PatientId, CancellationToken.None));
        }

        var betaAppointment = await CreateStartedAppointmentAsync(test, beta, "Beta", "Patient", "DB-1");
        await using var db = CreateDbContext(test.ConnectionString, alpha.TenantId);
        db.Examinations.Add(new Examination(alpha.TenantId, betaAppointment.PatientId, appointment.Id,
            alpha.AdminUserId, alpha.AdminUserId, Now));
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task PermissionsAndDoctorAppointmentVisibilityAreAuthoritative()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "dental-auth", "admin@dental-auth.example");
        await AcceptAsync(test, "admin@dental-auth.example"); SetActor(test, clinic);
        var own = await CreateStartedAppointmentAsync(test, clinic, "Own", "Patient", "DO-1");
        var other = await CreateStartedAppointmentAsync(test, clinic, "Other", "Patient", "DO-2");
        var receptionist = await InviteRoleAsync(test, "Reception", "reception@dental-auth.example", SystemRoleDefinitions.Receptionist);
        await AcceptAsync(test, "reception@dental-auth.example"); test.Tenant.Set(clinic.TenantId); test.User.UserId = receptionist;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<IExaminationCommands>()
                .CreateAsync(own.Id, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<IDentalQueries>()
                .GetChartAsync(own.PatientId, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider.GetRequiredService<IDentalQueries>()
                .GetHistoryAsync(own.PatientId, 10, CancellationToken.None));
        }

        test.User.UserId = own.DoctorUserId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var commands = scope.ServiceProvider.GetRequiredService<IExaminationCommands>();
            Assert.NotEqual(Guid.Empty, await commands.CreateAsync(own.Id, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => commands.CreateAsync(other.Id, CancellationToken.None));
        }
    }

    [Fact]
    public async Task ConcurrentDraftModificationAllowsExactlyOneStaleVersionWriter()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "dental-race", "admin@dental-race.example");
        await AcceptAsync(test, "admin@dental-race.example"); SetActor(test, clinic);
        var appointment = await CreateStartedAppointmentAsync(test, clinic, "Race", "Patient", "DR-1");
        Guid examinationId; Guid version;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            examinationId = await scope.ServiceProvider.GetRequiredService<IExaminationCommands>().CreateAsync(appointment.Id, CancellationToken.None);
            version = (await scope.ServiceProvider.GetRequiredService<IDentalQueries>().GetExaminationAsync(examinationId, CancellationToken.None))!.Version;
        }
        var results = await Task.WhenAll(AttemptNotesAsync(test, examinationId, "writer one", version),
            AttemptNotesAsync(test, examinationId, "writer two", version));
        Assert.Equal(1, results.Count(x => x));
    }

    private static async Task<bool> AttemptNotesAsync(TestContext test, Guid id, string notes, Guid version)
    {
        try
        {
            await using var scope = test.Provider.CreateAsyncScope(); await scope.ServiceProvider.GetRequiredService<IExaminationCommands>()
                .UpdateNotesAsync(id, notes, version, CancellationToken.None); return true;
        }
        catch (DentalConcurrencyException) { return false; }
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        { Database = $"dental_{Guid.NewGuid():N}", Pooling = false };
        await using (var db = CreateDbContext(builder.ConnectionString, null)) await db.Database.MigrateAsync();
        var tenant = new MutableTenant(); var user = new MutableUser(); var notifier = new CapturingNotifier();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Postgres"] = builder.ConnectionString, ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false" }).Build();
        var services = new ServiceCollection(); services.AddLogging(); services.AddApplication(); services.AddInfrastructure(configuration);
        services.RemoveAll<IPlatformAccessContext>(); services.RemoveAll<ISystemClock>(); services.RemoveAll<IClinicInvitationNotifier>();
        services.RemoveAll<ICurrentTenant>(); services.RemoveAll<ICurrentUser>();
        services.AddSingleton<IPlatformAccessContext>(new PlatformAccess()); services.AddSingleton<ISystemClock>(new FixedClock());
        services.AddSingleton<IClinicInvitationNotifier>(notifier); services.AddSingleton<ICurrentTenant>(tenant);
        services.AddSingleton<ICurrentUser>(user); services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        return new TestContext(services.BuildServiceProvider(), tenant, user, notifier, builder.ConnectionString);
    }

    private static async Task<ClinicalSetup> CreateStartedAppointmentAsync(TestContext test, CreateClinicResult clinic,
        string first, string last, string license)
    {
        SetActor(test, clinic); Guid patientId; Guid doctorUserId; Guid doctorId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            patientId = await scope.ServiceProvider.GetRequiredService<IPatientCommands>().CreateAsync(new CreatePatientCommand(
                new PatientProfileInput(first, null, last, Domain.Patients.PatientGender.NotSpecified, new DateOnly(1990, 1, 1),
                    "+20 100", null, null, null, "Cairo", "Egypt", null, null, null, null, null, null)), CancellationToken.None);
            var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == SystemRoleDefinitions.Doctor);
            doctorUserId = await users.InviteUserAsync(new InviteUserCommand("Doctor " + license, $"{license.ToLowerInvariant()}@dental.example", null, [role.Id]), CancellationToken.None);
        }
        await AcceptAsync(test, $"{license.ToLowerInvariant()}@dental.example"); SetActor(test, clinic);
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            doctorId = await scope.ServiceProvider.GetRequiredService<IDoctorProfileCommands>().CreateAsync(
                new CreateDoctorProfileCommand(doctorUserId, new DoctorProfileInput("Dentistry", license, null, 30)), CancellationToken.None);
            await scope.ServiceProvider.GetRequiredService<IDoctorScheduleService>().SetAsync(doctorId,
                [new SchedulePeriodInput(DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(18, 0), 30, [])], CancellationToken.None);
            var appointmentId = await scope.ServiceProvider.GetRequiredService<ICreateAppointment>().ExecuteAsync(
                new CreateAppointmentCommand(patientId, doctorId, AppointmentType.Consultation,
                    new AppointmentTimeInput(Monday, new TimeOnly(9 + (license[^1] % 8), 0), 30), null), CancellationToken.None);
            var lifecycle = scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>();
            await lifecycle.ConfirmAsync(appointmentId, CancellationToken.None); await lifecycle.CheckInAsync(appointmentId, CancellationToken.None);
            await lifecycle.StartAsync(appointmentId, CancellationToken.None);
            return new ClinicalSetup(appointmentId, patientId, doctorUserId, doctorId);
        }
    }

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null; await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IClinicManagementService>().CreateAsync(new CreateClinicCommand(
            $"Clinic {slug}", slug, "+20 1000", $"hello@{slug}.example", "1 Main", "Cairo", "Egypt",
            "Africa/Cairo", "EGP", email, null), CancellationToken.None);
    }
    private static async Task<Guid> InviteRoleAsync(TestContext test, string name, string email, string roleName)
    {
        await using var scope = test.Provider.CreateAsyncScope(); var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
        var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == roleName);
        return await users.InviteUserAsync(new InviteUserCommand(name, email, null, [role.Id]), CancellationToken.None);
    }
    private static async Task AcceptAsync(TestContext test, string email)
    {
        test.Tenant.Clear(); test.User.UserId = null; await using var scope = test.Provider.CreateAsyncScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<IInvitationService>().AcceptAsync(
            new AcceptInvitationCommand(test.Notifier.TokenFor(email), "A-strong-password-123!", "A-strong-password-123!"), CancellationToken.None));
    }
    private static void SetActor(TestContext test, CreateClinicResult clinic) { test.Tenant.Set(clinic.TenantId); test.User.UserId = clinic.AdminUserId; }
    private static ApplicationDbContext CreateDbContext(string cs, Guid? tenantId)
    {
        var tenant = new MutableTenant(); if (tenantId.HasValue) tenant.Set(tenantId.Value);
        return new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(cs).Options, tenant, new PlatformWriteScope());
    }

    private sealed record ClinicalSetup(Guid Id, Guid PatientId, Guid DoctorUserId, Guid DoctorProfileId);
    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User, CapturingNotifier Notifier, string ConnectionString) : IAsyncDisposable
    { public ValueTask DisposeAsync() => Provider.DisposeAsync(); }
    private sealed class MutableTenant : ICurrentTenant
    { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "dental-integration"; }
    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    { private readonly Dictionary<string, string> tokens = new(StringComparer.OrdinalIgnoreCase); public string TokenFor(string email) => tokens[email]; public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) { tokens[email] = token; return Task.CompletedTask; } }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
}
