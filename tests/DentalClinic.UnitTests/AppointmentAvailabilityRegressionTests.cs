using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class AppointmentAvailabilityRegressionTests
{
    [Theory]
    [InlineData(20)]
    [InlineData(30)]
    [InlineData(45)]
    [InlineData(60)]
    public async Task SessionDurationDoesNotHaveToBeAMultipleOfDoctorSlotLength(int duration)
    {
        var store = DispatchProxy.Create<IAppointmentStore, AppointmentStoreStub>();
        using var provider = new ServiceCollection().AddApplication().AddSingleton(store)
            .AddSingleton<IPermissionService>(new AllowPermissions()).BuildServiceProvider();
        var query = provider.GetRequiredService<IAppointmentAvailabilityQuery>();
        var doctor = ((AppointmentStoreStub)store).Doctor;
        var slots = await query.GetAsync(new(doctor.Id, new(2026, 10, 19), duration), CancellationToken.None);
        Assert.NotEmpty(slots);
        Assert.All(slots, x => Assert.Equal(duration, (x.EndAt - x.StartAt).TotalMinutes));
        Assert.All(slots, x => Assert.InRange(x.LocalStartTime, new TimeOnly(9, 0), new TimeOnly(12, 0)));
    }
    [Fact]
    public async Task EmergencySlotsCanBeOutsideNormalWorkingHours()
    {
        var store = DispatchProxy.Create<IAppointmentStore, AppointmentStoreStub>();
        using var provider = new ServiceCollection().AddApplication().AddSingleton(store)
            .AddSingleton<IPermissionService>(new AllowPermissions()).BuildServiceProvider();
        var query = provider.GetRequiredService<IAppointmentAvailabilityQuery>();
        var doctor = ((AppointmentStoreStub)store).Doctor;
        var slots = await query.GetAsync(new(doctor.Id, new(2026, 10, 19), 60, true), CancellationToken.None);
        Assert.Contains(slots, x => x.LocalStartTime == new TimeOnly(18, 0));
    }
    private sealed class AllowPermissions : IPermissionService
    {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken) => Task.CompletedTask;
    }
    public class AppointmentStoreStub : DispatchProxy
    {
        public DoctorProfile Doctor { get; } = new(Guid.NewGuid(), Guid.NewGuid(), "Dentistry", null, null, 60, DateTimeOffset.UtcNow);
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => targetMethod?.Name switch
        {
            nameof(IAppointmentStore.FindDoctorAsync) => Task.FromResult<DoctorProfile?>(Doctor),
            nameof(IAppointmentStore.GetTenantTimeZoneAsync) => Task.FromResult("UTC"),
            nameof(IAppointmentStore.GetBusyPeriodsAsync) => Task.FromResult<IReadOnlyCollection<AppointmentBusyPeriod>>([]),
            nameof(IAppointmentStore.GetScheduleAsync) => Task.FromResult<IReadOnlyCollection<DoctorSchedule>>([
                new DoctorSchedule(Doctor.TenantId, Doctor.Id, DayOfWeek.Monday, new(9, 0), new(12, 0), 60, [], DateTimeOffset.UtcNow)]),
            _ => throw new NotSupportedException(targetMethod?.Name),
        };
    }
}
