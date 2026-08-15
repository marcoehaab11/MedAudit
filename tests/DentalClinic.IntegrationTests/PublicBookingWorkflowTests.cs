using DentalClinic.Application;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Identity.Models;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Platform;
using DentalClinic.Application.PublicBooking;
using DentalClinic.Application.Tenants;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Tenancy;
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
public sealed class PublicBookingWorkflowTests(PlatformPostgresFixture fixture)
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 8, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly TargetMonday = new(2026, 8, 17);

    [Fact]
    public async Task PublicClinicResolutionAndDoctorEligibilityWorkCorrectly()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "public-clinic-a", "admin@public-a.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-a@public.example", "DOC-A1");

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var publicClinic = await service.GetClinicBySlugAsync("public-clinic-a", CancellationToken.None);
        Assert.NotNull(publicClinic);
        Assert.Equal("public-clinic-a", publicClinic.Slug);
        Assert.True(publicClinic.PublicBookingEnabled);

        var doctors = await service.GetDoctorsAsync("public-clinic-a", CancellationToken.None);
        Assert.Single(doctors);
        Assert.Equal(doctor.ProfileId, doctors.First().DoctorProfileId);
    }

    [Fact]
    public async Task DisabledPublicBookingThrowsDisabledException()
    {
        await using var test = await CreateContextAsync();
        await CreateClinicAsync(test, "disabled-clinic", "admin@disabled.example");

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        await Assert.ThrowsAsync<PublicBookingDisabledException>(
            () => service.GetClinicBySlugAsync("disabled-clinic", CancellationToken.None));
    }

    [Fact]
    public async Task AvailabilitySlotsCalculatedCorrectlyForPublicBooking()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "avail-clinic", "admin@avail.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-avail@public.example", "DOC-AV1");

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slots = await service.GetAvailabilityAsync("avail-clinic", doctor.ProfileId, TargetMonday, null, CancellationToken.None);
        Assert.NotEmpty(slots);
        Assert.Contains(slots, x => x.StartTime == new TimeOnly(9, 0));
    }

    [Fact]
    public async Task PublicBookingCreationPatientMatchingAndOpaqueReferenceWork()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "booking-clinic", "admin@booking.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-booking@public.example", "DOC-BK1");
        var catalogService = await CreateTreatmentServiceAsync(test, clinic.TenantId, "Teeth Cleaning", "CLN-01", 100m, 30);

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slots = await service.GetAvailabilityAsync("booking-clinic", doctor.ProfileId, TargetMonday, catalogService.Id, CancellationToken.None);
        var firstSlot = slots.First(x => x.StartTime == new TimeOnly(9, 0));

        var request = new PublicBookingRequest(
            "booking-clinic",
            doctor.ProfileId,
            catalogService.Id,
            firstSlot.StartAt,
            30,
            "Laila Mahmoud",
            "+201012345678",
            "laila@example.com",
            new DateOnly(1995, 4, 12),
            "First visit routine checkup",
            "idempotency-key-001"
        );

        var confirmation = await service.CreateBookingAsync(request, CancellationToken.None);
        Assert.NotNull(confirmation);
        Assert.StartsWith("BK-", confirmation.BookingReference);
        Assert.Equal("Laila Mahmoud", confirmation.PatientName);

        // Verify patient record created and phone normalized
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var patient = await db.Patients.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.TenantId == clinic.TenantId && p.Phone == "201012345678");
        Assert.NotNull(patient);
        Assert.Equal("Laila", patient.FirstName);

        // Verify lookup by reference works
        var lookedUp = await service.GetBookingByReferenceAsync(confirmation.BookingReference, CancellationToken.None);
        Assert.NotNull(lookedUp);
        Assert.Equal(confirmation.BookingReference, lookedUp.BookingReference);
    }

    [Fact]
    public async Task IdempotencyKeyReturnsOriginalBookingConfirmation()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "idempotent-clinic", "admin@idempotent.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-idemp@public.example", "DOC-ID1");
        var catalogService = await CreateTreatmentServiceAsync(test, clinic.TenantId, "Consultation", "CNS-01", 50m, 30);

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slots = await service.GetAvailabilityAsync("idempotent-clinic", doctor.ProfileId, TargetMonday, catalogService.Id, CancellationToken.None);
        var slot = slots.First(x => x.StartTime == new TimeOnly(10, 0));

        var request = new PublicBookingRequest(
            "idempotent-clinic",
            doctor.ProfileId,
            catalogService.Id,
            slot.StartAt,
            30,
            "Tarek Ahmed",
            "+201099887766",
            "tarek@example.com",
            null,
            null,
            "same-idempotency-key-xyz"
        );

        var conf1 = await service.CreateBookingAsync(request, CancellationToken.None);
        var conf2 = await service.CreateBookingAsync(request, CancellationToken.None);

        Assert.Equal(conf1.BookingReference, conf2.BookingReference);
    }

    [Fact]
    public async Task IdempotencyKeyWithDifferentPayloadIsRejected()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "idemp-mismatch-clinic", "admin@idemp-mismatch.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-mismatch@public.example", "DOC-MM1");
        var catalogService = await CreateTreatmentServiceAsync(test, clinic.TenantId, "Consultation", "CNS-02", 50m, 30);

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slots = await service.GetAvailabilityAsync("idemp-mismatch-clinic", doctor.ProfileId, TargetMonday, catalogService.Id, CancellationToken.None);
        var slot1 = slots.First(x => x.StartTime == new TimeOnly(10, 0));
        var slot2 = slots.First(x => x.StartTime == new TimeOnly(10, 30));

        var request1 = new PublicBookingRequest(
            "idemp-mismatch-clinic", doctor.ProfileId, catalogService.Id, slot1.StartAt, 30, "Same Person", "+201099880000", null, null, null, "shared-key-123"
        );

        var request2 = new PublicBookingRequest(
            "idemp-mismatch-clinic", doctor.ProfileId, catalogService.Id, slot2.StartAt, 30, "Different Person", "+201099881111", null, null, null, "shared-key-123"
        );

        await service.CreateBookingAsync(request1, CancellationToken.None);

        await Assert.ThrowsAsync<PublicBookingConflictException>(
            () => service.CreateBookingAsync(request2, CancellationToken.None));
    }

    [Fact]
    public async Task PatientMatchingIsStrictlyTenantScoped()
    {
        await using var test = await CreateContextAsync();
        var clinicA = await CreateClinicAsync(test, "tenant-a-clinic", "admin@tenant-a.example");
        var clinicB = await CreateClinicAsync(test, "tenant-b-clinic", "admin@tenant-b.example");
        await EnablePublicBookingAsync(test, clinicA.TenantId);
        await EnablePublicBookingAsync(test, clinicB.TenantId);

        var docA = await CreateDoctorAsync(test, clinicA, "doc-a@tenant-a.example", "DOC-TA");
        var docB = await CreateDoctorAsync(test, clinicB, "doc-b@tenant-b.example", "DOC-TB");

        var svcA = await CreateTreatmentServiceAsync(test, clinicA.TenantId, "Service A", "SVC-A", 100m, 30);
        var svcB = await CreateTreatmentServiceAsync(test, clinicB.TenantId, "Service B", "SVC-B", 100m, 30);

        test.Tenant.Clear();
        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slotsA = await service.GetAvailabilityAsync("tenant-a-clinic", docA.ProfileId, TargetMonday, svcA.Id, CancellationToken.None);
        var slotsB = await service.GetAvailabilityAsync("tenant-b-clinic", docB.ProfileId, TargetMonday, svcB.Id, CancellationToken.None);

        var sharedPhone = "+201055554444";

        var reqA = new PublicBookingRequest("tenant-a-clinic", docA.ProfileId, svcA.Id, slotsA.First().StartAt, 30, "Patient In A", sharedPhone, null, null, null, "key-a");
        var reqB = new PublicBookingRequest("tenant-b-clinic", docB.ProfileId, svcB.Id, slotsB.First().StartAt, 30, "Patient In B", sharedPhone, null, null, null, "key-b");

        await service.CreateBookingAsync(reqA, CancellationToken.None);
        await service.CreateBookingAsync(reqB, CancellationToken.None);

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var patientInA = await db.Patients.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.TenantId == clinicA.TenantId && p.Phone == "201055554444");
        var patientInB = await db.Patients.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.TenantId == clinicB.TenantId && p.Phone == "201055554444");

        Assert.NotNull(patientInA);
        Assert.NotNull(patientInB);
        Assert.NotEqual(patientInA.Id, patientInB.Id);
    }

    [Fact]
    public async Task ConcurrentOrDuplicateSlotBookingReturnsConflict()
    {
        await using var test = await CreateContextAsync();
        var clinic = await CreateClinicAsync(test, "conflict-clinic", "admin@conflict.example");
        await EnablePublicBookingAsync(test, clinic.TenantId);
        var doctor = await CreateDoctorAsync(test, clinic, "doc-conflict@public.example", "DOC-CF1");
        var catalogService = await CreateTreatmentServiceAsync(test, clinic.TenantId, "Filling", "FIL-01", 120m, 30);

        await using var scope = test.Provider.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IPublicBookingService>();

        var slots = await service.GetAvailabilityAsync("conflict-clinic", doctor.ProfileId, TargetMonday, catalogService.Id, CancellationToken.None);
        var slot = slots.First(x => x.StartTime == new TimeOnly(11, 0));

        var request1 = new PublicBookingRequest(
            "conflict-clinic", doctor.ProfileId, catalogService.Id, slot.StartAt, 30, "Patient One", "+201111111111", null, null, null, "key-1"
        );
        var request2 = new PublicBookingRequest(
            "conflict-clinic", doctor.ProfileId, catalogService.Id, slot.StartAt, 30, "Patient Two", "+202222222222", null, null, null, "key-2"
        );

        await service.CreateBookingAsync(request1, CancellationToken.None);

        await Assert.ThrowsAsync<PublicBookingConflictException>(
            () => service.CreateBookingAsync(request2, CancellationToken.None));
    }

    private async Task<TestContext> CreateContextAsync()
    {
        var masterConn = fixture.Postgres.GetConnectionString();
        var databaseName = $"public_booking_test_{Guid.NewGuid():N}";
        await using (var conn = new NpgsqlConnection(masterConn))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE \"{databaseName}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(masterConn) { Database = databaseName };
        var connectionString = builder.ConnectionString;

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = connectionString,
            ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false"
        }).Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        var tenant = new MutableTenant();
        var user = new MutableUser();
        var notifier = new CapturingNotifier();

        services.RemoveAll<IPlatformAccessContext>();
        services.RemoveAll<ISystemClock>();
        services.RemoveAll<IClinicInvitationNotifier>();
        services.RemoveAll<ICurrentTenant>();
        services.RemoveAll<ICurrentUser>();

        services.AddSingleton<IPlatformAccessContext>(new PlatformAccess());
        services.AddSingleton<ISystemClock>(new FixedClock());
        services.AddSingleton<IClinicInvitationNotifier>(notifier);
        services.AddSingleton<ICurrentTenant>(tenant);
        services.AddSingleton<ICurrentUser>(user);
        services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();

        var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        return new TestContext(provider, tenant, user, connectionString, databaseName, fixture.Postgres.GetConnectionString());
    }

    private static async Task<CreateClinicResult> CreateClinicAsync(TestContext test, string slug, string email)
    {
        test.Tenant.Clear();
        test.User.UserId = null;
        await using var scope = test.Provider.CreateAsyncScope();
        var clinics = scope.ServiceProvider.GetRequiredService<IClinicManagementService>();
        return await clinics.CreateAsync(new CreateClinicCommand(
            "Clinic " + slug, slug, "+20 1000", email, "Address", "Cairo", "Egypt", "Africa/Cairo", "EGP", email, null), CancellationToken.None);
    }

    private static async Task EnablePublicBookingAsync(TestContext test, Guid tenantId)
    {
        test.Tenant.Set(tenantId);
        await using var scope = test.Provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var config = await db.TenantConfigurations.IgnoreQueryFilters().FirstAsync(c => c.TenantId == tenantId);
        config.UpdatePublicBookingSettings(true, 30, true);
        await db.SaveChangesAsync();
    }

    private static async Task<DoctorResult> CreateDoctorAsync(TestContext test, CreateClinicResult clinic, string email, string license)
    {
        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        Guid userId;
        await using (var scope = test.Provider.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var role = (await users.GetRolesAsync(CancellationToken.None)).Single(x => x.Name == SystemRoleDefinitions.Doctor);
            userId = await users.InviteUserAsync(new InviteUserCommand("Doctor", email, null, [role.Id]), CancellationToken.None);
        }

        test.Tenant.Set(clinic.TenantId);
        test.User.UserId = clinic.AdminUserId;
        await using var profileScope = test.Provider.CreateAsyncScope();
        var profileId = await profileScope.ServiceProvider.GetRequiredService<IDoctorProfileCommands>().CreateAsync(
            new CreateDoctorProfileCommand(userId, new DoctorProfileInput("General dentistry", license, null, 30)), CancellationToken.None);

        await profileScope.ServiceProvider.GetRequiredService<IDoctorScheduleService>().SetAsync(profileId, [
            new SchedulePeriodInput(DayOfWeek.Monday, new TimeOnly(9, 0), new TimeOnly(17, 0), 30, [new ScheduleBreakInput(new TimeOnly(13, 0), new TimeOnly(14, 0))])
        ], CancellationToken.None);

        return new DoctorResult(userId, profileId);
    }

    private static async Task<Domain.Treatments.TreatmentCatalogItem> CreateTreatmentServiceAsync(
        TestContext test, Guid tenantId, string name, string code, decimal price, int duration)
    {
        test.Tenant.Set(tenantId);
        await using var scope = test.Provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var item = new Domain.Treatments.TreatmentCatalogItem(
            tenantId, Domain.Treatments.TreatmentType.Other, name, code, "Description", price, Now, true, duration);
        await db.TreatmentCatalogItems.AddAsync(item);
        await db.SaveChangesAsync();
        return item;
    }

    private sealed record TestContext(ServiceProvider Provider, MutableTenant Tenant, MutableUser User, string ConnectionString, string DatabaseName, string MasterConnectionString) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            await Provider.DisposeAsync();
            await using var conn = new NpgsqlConnection(MasterConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{DatabaseName}\" WITH (FORCE);";
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private sealed record DoctorResult(Guid UserId, Guid ProfileId);

    private sealed class FixedClock : ISystemClock { public DateTimeOffset UtcNow => Now; }
    private sealed class MutableTenant : ICurrentTenant { public Guid? TenantId { get; private set; } public bool IsAvailable => TenantId.HasValue; public Guid RequireTenantId() => TenantId ?? throw new InvalidOperationException(); public void Set(Guid id) => TenantId = id; public void Clear() => TenantId = null; }
    private sealed class MutableUser : ICurrentUser { public Guid? UserId { get; set; } }
    private sealed class PlatformAccess : IPlatformAccessContext { public bool IsPlatformAdmin => true; public Guid? UserId => Guid.NewGuid(); public string? CorrelationId => "public-booking-integration"; }
    private sealed class CapturingNotifier : IClinicInvitationNotifier { public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask; }
    private sealed class FakeTokenIssuer : IAccessTokenIssuer { public (string Token, DateTimeOffset ExpiresAt) Issue(Guid userId, Guid tenantId, string displayName, IReadOnlyCollection<string> roles, IReadOnlyCollection<string> permissions) => ($"test-{userId:D}", Now.AddHours(1)); }
}
