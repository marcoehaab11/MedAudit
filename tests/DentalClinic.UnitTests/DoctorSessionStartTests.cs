using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using Microsoft.Extensions.DependencyInjection;
namespace DentalClinic.UnitTests;

public sealed class DoctorSessionStartTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DoctorCanStartOwnScheduledOrConfirmedFollowUp(bool confirmed)
    {
        var store = DispatchProxy.Create<IAppointmentStore, Store>();
        var spy = (Store)store;
        if (confirmed) spy.Appointment.Confirm(DateTimeOffset.UtcNow);
        using var services = Services(store);
        Assert.True(await services.GetRequiredService<IAppointmentLifecycle>().StartAsync(spy.Appointment.Id, CancellationToken.None));
        Assert.Equal(AppointmentStatus.InProgress, spy.Appointment.Status);
        Assert.NotNull(spy.Appointment.CheckedInAt);
        Assert.True(spy.Saved);
    }
    [Fact]
    public async Task DoctorCannotStartAnotherDoctorsFollowUp()
    {
        var store = DispatchProxy.Create<IAppointmentStore, Store>();
        ((Store)store).OwnDoctor = Guid.NewGuid();
        using var services = Services(store);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => services.GetRequiredService<IAppointmentLifecycle>().StartAsync(((Store)store).Appointment.Id, CancellationToken.None));
        Assert.Equal(AppointmentStatus.Scheduled, ((Store)store).Appointment.Status);
        Assert.False(((Store)store).Saved);
    }
    private static ServiceProvider Services(IAppointmentStore store) => new ServiceCollection().AddApplication()
        .AddSingleton(store).AddSingleton<IPermissionService>(new PermissionsStub())
        .AddSingleton<ICurrentUser>(new Actor()).AddSingleton<ICurrentTenant>(new Tenant())
        .AddSingleton<ISystemClock>(new Clock()).BuildServiceProvider();
    private sealed class PermissionsStub : IPermissionService
    {
        public Task<bool> HasPermissionAsync(string permission, CancellationToken token) => Task.FromResult(permission == Permissions.AppointmentsStart);
        public Task EnsurePermissionAsync(string permission, CancellationToken token) => permission == Permissions.AppointmentsStart ? Task.CompletedTask : Task.FromException(new ForbiddenAccessException("Denied"));
    }
    private sealed class Actor : ICurrentUser { public Guid? UserId => Guid.Parse("11111111-1111-1111-1111-111111111111"); }
    private sealed class Tenant : ICurrentTenant { public Guid? TenantId => Guid.Parse("22222222-2222-2222-2222-222222222222"); public bool IsAvailable => true; public Guid RequireTenantId() => TenantId!.Value; }
    private sealed class Clock : ISystemClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }
    public class Store : DispatchProxy
    {
        public Appointment Appointment { get; } = new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), (AppointmentType)1, DateTimeOffset.UtcNow, 60, null, Guid.NewGuid(), DateTimeOffset.UtcNow);
        public Guid? OwnDoctor { get; set; }
        public bool Saved { get; private set; }
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            switch (targetMethod?.Name)
            {
                case nameof(IAppointmentStore.FindAsync): return Task.FromResult<Appointment?>(Appointment);
                case nameof(IAppointmentStore.FindDoctorProfileIdForUserAsync): return Task.FromResult<Guid?>(OwnDoctor ?? Appointment.DoctorProfileId);
                case nameof(IAppointmentStore.AddAudit): return null;
                case nameof(IAppointmentStore.SaveChangesAsync): Saved = true; return Task.CompletedTask;
                default: throw new NotSupportedException(targetMethod?.Name);
            }
        }
    }
}
