using DentalClinic.Application;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
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
public sealed class AppointmentWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 8, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Monday = new(2026, 8, 17);

    [Fact]
    public async Task CreationAvailabilityTimezoneAndLifecycleWorkTogether()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "appointment-flow", "admin@appointment-flow.example");
        await AcceptAsync(test, "admin@appointment-flow.example");
        SetActor(test, clinic);
        var patient = await CreatePatientAsync(test, "Mona", "Hassan");
        var doctor = await CreateDoctorAsync(test, clinic, "flow-doctor@appointment.example", "FLOW-1");

        await using var scope = test.Provider.CreateAsyncScope();
        var availability = scope.ServiceProvider.GetRequiredService<IAppointmentAvailabilityQuery>();
        var slots = await availability.GetAsync(new DoctorAvailabilityQuery(doctor.ProfileId, Monday, 60), CancellationToken.None);
        var nineAm = slots.Single(x => x.LocalStartTime == new TimeOnly(9, 0));
        Assert.Equal(new DateTimeOffset(2026, 8, 17, 6, 0, 0, TimeSpan.Zero), nineAm.StartAt);
        Assert.DoesNotContain(slots, x => x.LocalStartTime == new TimeOnly(12, 30));

        var appointmentId = await scope.ServiceProvider.GetRequiredService<ICreateAppointment>().ExecuteAsync(
            Command(patient, doctor.ProfileId, new TimeOnly(9, 0), 60), CancellationToken.None);
        var details = await scope.ServiceProvider.GetRequiredService<IAppointmentQueries>()
            .GetAsync(appointmentId, CancellationToken.None);
        Assert.NotNull(details);
        Assert.Equal("Africa/Cairo", details.TimeZone);
        Assert.Equal(nineAm.StartAt, details.StartAt);

        var lifecycle = scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>();
        Assert.True(await lifecycle.ConfirmAsync(appointmentId, CancellationToken.None));
        Assert.True(await lifecycle.CheckInAsync(appointmentId, CancellationToken.None));
        Assert.True(await lifecycle.StartAsync(appointmentId, CancellationToken.None));
        Assert.True(await lifecycle.CompleteAsync(appointmentId, CancellationToken.None));
        Assert.Equal(AppointmentStatus.Completed, (await scope.ServiceProvider.GetRequiredService<IAppointmentQueries>()
            .GetAsync(appointmentId, CancellationToken.None))!.Status);
    }

    [Fact]
    public async Task ConflictsReschedulingAndCancellationFollowDatabaseRules()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "appointment-rules", "admin@appointment-rules.example");
        await AcceptAsync(test, "admin@appointment-rules.example");
        SetActor(test, clinic);
        var patientA = await CreatePatientAsync(test, "A", "Patient");
        var patientB = await CreatePatientAsync(test, "B", "Patient");
        var doctor = await CreateDoctorAsync(test, clinic, "rules-doctor@appointment.example", "RULE-1");
        Guid first;
        Guid second;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var create = scope.ServiceProvider.GetRequiredService<ICreateAppointment>();
            first = await create.ExecuteAsync(Command(patientA, doctor.ProfileId, new TimeOnly(9, 0)), CancellationToken.None);
            await Assert.ThrowsAsync<AppointmentConflictException>(() => create.ExecuteAsync(
                Command(patientB, doctor.ProfileId, new TimeOnly(9, 0)), CancellationToken.None));
            second = await create.ExecuteAsync(Command(patientB, doctor.ProfileId, new TimeOnly(10, 0)), CancellationToken.None);
            await Assert.ThrowsAsync<AppointmentConflictException>(() => scope.ServiceProvider
                .GetRequiredService<IRescheduleAppointment>().ExecuteAsync(
                    new RescheduleAppointmentCommand(second, Time(new TimeOnly(9, 0))), CancellationToken.None));
            Assert.True(await scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>()
                .CancelAsync(first, "Patient requested another time", CancellationToken.None));
            var replacement = await create.ExecuteAsync(
                Command(patientB, doctor.ProfileId, new TimeOnly(9, 0)), CancellationToken.None);
            Assert.True(await scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>()
                .MarkNoShowAsync(replacement, CancellationToken.None));
            Assert.Equal(AppointmentStatus.NoShow, (await scope.ServiceProvider.GetRequiredService<IAppointmentQueries>()
                .GetAsync(replacement, CancellationToken.None))!.Status);
            await Assert.ThrowsAsync<AppointmentConflictException>(() => create.ExecuteAsync(
                Command(patientA, doctor.ProfileId, new TimeOnly(9, 0)), CancellationToken.None));
        }
    }

    [Fact]
    public async Task ConcurrentDoctorBookingAllowsExactlyOneRequest()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "doctor-race", "admin@doctor-race.example");
        await AcceptAsync(test, "admin@doctor-race.example");
        SetActor(test, clinic);
        var patientA = await CreatePatientAsync(test, "Race", "One");
        var patientB = await CreatePatientAsync(test, "Race", "Two");
        var doctor = await CreateDoctorAsync(test, clinic, "doctor-race@appointment.example", "RACE-D");

        var results = await Task.WhenAll(
            AttemptCreateAsync(test, Command(patientA, doctor.ProfileId, new TimeOnly(11, 0))),
            AttemptCreateAsync(test, Command(patientB, doctor.ProfileId, new TimeOnly(11, 0))));

        Assert.Equal(1, results.Count(x => x));
        await using var db = CreateDbContext(test.ConnectionString);
        Assert.Equal(1, await db.Appointments.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task ConcurrentPatientBookingAllowsExactlyOneRequest()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "patient-race", "admin@patient-race.example");
        await AcceptAsync(test, "admin@patient-race.example");
        SetActor(test, clinic);
        var patient = await CreatePatientAsync(test, "Patient", "Race");
        var doctorA = await CreateDoctorAsync(test, clinic, "patient-race-a@appointment.example", "RACE-A");
        var doctorB = await CreateDoctorAsync(test, clinic, "patient-race-b@appointment.example", "RACE-B");

        var results = await Task.WhenAll(
            AttemptCreateAsync(test, Command(patient, doctorA.ProfileId, new TimeOnly(11, 0))),
            AttemptCreateAsync(test, Command(patient, doctorB.ProfileId, new TimeOnly(11, 0))));

        Assert.Equal(1, results.Count(x => x));
        await using var db = CreateDbContext(test.ConnectionString);
        Assert.Equal(1, await db.Appointments.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task TenantAndDoctorVisibilityBoundariesAreEnforced()
    {
        await using var test = await CreateContextAsync();
        var alpha = await CreateClinicAsync(test, "appointment-alpha", "admin@appointment-alpha.example");
        var beta = await CreateClinicAsync(test, "appointment-beta", "admin@appointment-beta.example");
        await AcceptAsync(test, "admin@appointment-alpha.example");
        await AcceptAsync(test, "admin@appointment-beta.example");
        SetActor(test, alpha);
        var patient = await CreatePatientAsync(test, "Tenant", "Alpha");
        var doctorA = await CreateDoctorAsync(test, alpha, "alpha-a@appointment.example", "ALPHA-A");
        var doctorB = await CreateDoctorAsync(test, alpha, "alpha-b@appointment.example", "ALPHA-B");
        Guid appointmentA;
        Guid appointmentB;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var create = scope.ServiceProvider.GetRequiredService<ICreateAppointment>();
            appointmentA = await create.ExecuteAsync(Command(patient, doctorA.ProfileId, new TimeOnly(9, 0)), CancellationToken.None);
            appointmentB = await create.ExecuteAsync(Command(patient, doctorB.ProfileId, new TimeOnly(10, 0)), CancellationToken.None);
        }

        test.User.UserId = doctorA.UserId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var queries = scope.ServiceProvider.GetRequiredService<IAppointmentQueries>();
            Assert.NotNull(await queries.GetAsync(appointmentA, CancellationToken.None));
            Assert.Null(await queries.GetAsync(appointmentB, CancellationToken.None));
            Assert.Single((await queries.SearchAsync(new AppointmentSearchQuery(Monday, Monday), CancellationToken.None)).Page.Items);
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<IAppointmentAvailabilityQuery>()
                .GetAsync(new DoctorAvailabilityQuery(doctorB.ProfileId, Monday, 30), CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => scope.ServiceProvider
                .GetRequiredService<ICreateAppointment>().ExecuteAsync(
                    Command(patient, doctorA.ProfileId, new TimeOnly(12, 0)), CancellationToken.None));
        }

        SetActor(test, beta);
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            Assert.Null(await scope.ServiceProvider.GetRequiredService<IAppointmentQueries>()
                .GetAsync(appointmentA, CancellationToken.None));
            Assert.False(await scope.ServiceProvider.GetRequiredService<IRescheduleAppointment>()
                .ExecuteAsync(new RescheduleAppointmentCommand(appointmentA, Time(new TimeOnly(12, 0))), CancellationToken.None));
            await Assert.ThrowsAsync<ValidationException>(() => scope.ServiceProvider
                .GetRequiredService<ICreateAppointment>().ExecuteAsync(
                    Command(patient, doctorA.ProfileId, new TimeOnly(12, 0)), CancellationToken.None));
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<IAppointmentAvailabilityQuery>()
                .GetAsync(new DoctorAvailabilityQuery(doctorA.ProfileId, Monday, 30), CancellationToken.None));
        }
    }

    [Fact]
    public async Task ReceptionistAndDoctorReceiveLeastPrivilegeWorkflowAccess()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "appointment-roles", "admin@appointment-roles.example");
        await AcceptAsync(test, "admin@appointment-roles.example");
        SetActor(test, clinic);
        var patient = await CreatePatientAsync(test, "Role", "Patient");
        var doctor = await CreateDoctorAsync(test, clinic, "role-doctor@appointment.example", "ROLE-D");
        var receptionistId = await InviteRoleAsync(test, "Reception", "reception@appointment-roles.example",
            SystemRoleDefinitions.Receptionist);
        await AcceptAsync(test, "reception@appointment-roles.example");
        test.Tenant.Set(clinic.TenantId); test.User.UserId = receptionistId;
        Guid appointmentId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            appointmentId = await scope.ServiceProvider.GetRequiredService<ICreateAppointment>().ExecuteAsync(
                Command(patient, doctor.ProfileId, new TimeOnly(15, 0)), CancellationToken.None);
            var lifecycle = scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>();
            Assert.True(await lifecycle.ConfirmAsync(appointmentId, CancellationToken.None));
            Assert.True(await lifecycle.CheckInAsync(appointmentId, CancellationToken.None));
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => lifecycle.StartAsync(appointmentId, CancellationToken.None));
        }

        test.User.UserId = doctor.UserId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var lifecycle = scope.ServiceProvider.GetRequiredService<IAppointmentLifecycle>();
            Assert.True(await lifecycle.StartAsync(appointmentId, CancellationToken.None));
            Assert.True(await lifecycle.CompleteAsync(appointmentId, CancellationToken.None));
        }
    }

    [Fact]
    public async Task InvalidDaylightSavingLocalTimesAreNotBookable()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "appointment-dst", "admin@appointment-dst.example", "America/New_York");
        await AcceptAsync(test, "admin@appointment-dst.example");
        SetActor(test, clinic);
        var patient = await CreatePatientAsync(test, "Dst", "Patient");
        var doctor = await CreateDoctorAsync(test, clinic, "dst-doctor@appointment.example", "DST-D");
        await using var scope = test.Provider.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<IDoctorScheduleService>().SetAsync(doctor.ProfileId,
        [
            new SchedulePeriodInput(DayOfWeek.Sunday, new TimeOnly(1, 0), new TimeOnly(4, 0), 30, [])
        ], CancellationToken.None);
        var dstDate = new DateOnly(2026, 3, 8);
        var slots = await scope.ServiceProvider.GetRequiredService<IAppointmentAvailabilityQuery>()
            .GetAsync(new DoctorAvailabilityQuery(doctor.ProfileId, dstDate, 30), CancellationToken.None);
        Assert.DoesNotContain(slots, x => x.LocalStartTime.Hour == 2);
        var longSlots = await scope.ServiceProvider.GetRequiredService<IAppointmentAvailabilityQuery>()
            .GetAsync(new DoctorAvailabilityQuery(doctor.ProfileId, dstDate, 120), CancellationToken.None);
        Assert.DoesNotContain(longSlots, x => x.LocalStartTime == new TimeOnly(1, 0));
        await Assert.ThrowsAsync<ValidationException>(() => scope.ServiceProvider.GetRequiredService<ICreateAppointment>()
            .ExecuteAsync(new CreateAppointmentCommand(patient, doctor.ProfileId, AppointmentType.Consultation,
                new AppointmentTimeInput(dstDate, new TimeOnly(2, 0), 30), null), CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => scope.ServiceProvider.GetRequiredService<ICreateAppointment>()
            .ExecuteAsync(new CreateAppointmentCommand(patient, doctor.ProfileId, AppointmentType.Consultation,
                new AppointmentTimeInput(dstDate, new TimeOnly(1, 0), 120), null), CancellationToken.None));
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.Postgres.GetConnectionString())
        { Database = $"appointments_{Guid.NewGuid():N}", Pooling = false };
        var connectionString = builder.ConnectionString;
        await using (var db = CreateDbContext(connectionString)) await db.Database.MigrateAsync();
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

    private static async Task<CreateClinicResult> CreateClinicAsync(
        TestContext test, string slug, string email, string timeZone = "Africa/Cairo")
    {
        test.Tenant.Clear(); test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IClinicManagementService>().CreateAsync(new CreateClinicCommand(
            $"Clinic {slug}", slug, "+20 1000", $"hello@{slug}.example", "1 Main Street", "Cairo", "Egypt",
            timeZone, "EGP", email, null), CancellationToken.None);
    }

    private static async Task<Guid> CreatePatientAsync(TestContext test, string firstName, string lastName)
    {
        await using var scope = test.Provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPatientCommands>().CreateAsync(new CreatePatientCommand(
            new PatientProfileInput(firstName, null, lastName, PatientGender.NotSpecified, new DateOnly(1990, 1, 1),
                "+20 100", null, null, null, "Cairo", "Egypt", null, null, null, null, null, null)), CancellationToken.None);
    }

    private static async Task<DoctorResult> CreateDoctorAsync(TestContext test, CreateClinicResult clinic, string email, string license)
    {
        SetActor(test, clinic);
        Guid userId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == SystemRoleDefinitions.Doctor);
            userId = await users.InviteUserAsync(new InviteUserCommand("Doctor", email, null, [role.Id]), CancellationToken.None);
        }
        await AcceptAsync(test, email);
        SetActor(test, clinic);
        await using var profileScope = test.Provider.CreateAsyncScope();
        var profileId = await profileScope.ServiceProvider.GetRequiredService<IDoctorProfileCommands>().CreateAsync(
            new CreateDoctorProfileCommand(userId, new DoctorProfileInput("General dentistry", license, null, 30)), CancellationToken.None);
        await profileScope.ServiceProvider.GetRequiredService<IDoctorScheduleService>().SetAsync(profileId,
        [
            new SchedulePeriodInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0), 30,
                [new ScheduleBreakInput(new TimeOnly(13, 0), new TimeOnly(14, 0))])
        ], CancellationToken.None);
        return new DoctorResult(userId, profileId);
    }

    private static async Task<Guid> InviteRoleAsync(
        TestContext test, string name, string email, string roleName)
    {
        await using var scope = test.Provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
        var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == roleName);
        return await users.InviteUserAsync(new InviteUserCommand(name, email, null, [role.Id]), CancellationToken.None);
    }

    private static async Task<bool> AttemptCreateAsync(TestContext test, CreateAppointmentCommand command)
    {
        try
        {
            await using var scope = test.Provider.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<ICreateAppointment>().ExecuteAsync(command, CancellationToken.None);
            return true;
        }
        catch (AppointmentConflictException) { return false; }
    }

    private static CreateAppointmentCommand Command(Guid patientId, Guid doctorId, TimeOnly start, int duration = 30) =>
        new(patientId, doctorId, AppointmentType.Consultation, Time(start, duration), "Appointment notes");
    private static AppointmentTimeInput Time(TimeOnly start, int duration = 30) => new(Monday, start, duration);

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
    private static ApplicationDbContext CreateDbContext(string connectionString) => new(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connectionString).Options,
        new MutableTenant(), new PlatformWriteScope());

    private sealed record DoctorResult(Guid UserId, Guid ProfileId);
    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User,
        CapturingNotifier Notifier, string ConnectionString) : IAsyncDisposable
    { public ValueTask DisposeAsync() => Provider.DisposeAsync(); }
    private sealed class MutableTenant : ICurrentTenant
    { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "appointment-integration"; }
    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier
    { private readonly Dictionary<string, string> tokens = new(StringComparer.OrdinalIgnoreCase); public string TokenFor(string email) => tokens[email]; public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) { tokens[email] = token; return Task.CompletedTask; } }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
}
