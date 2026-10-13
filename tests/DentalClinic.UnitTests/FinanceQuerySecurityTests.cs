using System.Reflection;
using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Finance;
using DentalClinic.Application.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class FinanceQuerySecurityTests
{
    [Fact]
    public async Task DoctorCompensationUsesAuthenticatedActorOnly()
    {
        var actor = Guid.NewGuid();
        var store = DispatchProxy.Create<IFinanceStore, StoreSpy>();
        var spy = (StoreSpy)store;
        var permissions = new PermissionStub(true);
        using var services = new ServiceCollection().AddApplication()
            .AddSingleton(store).AddSingleton<IPermissionService>(permissions)
            .AddSingleton<ICurrentUser>(new ActorStub(actor)).BuildServiceProvider();
        var value = await services.GetRequiredService<IFinanceQueries>().MyDuesAsync(CancellationToken.None);
        Assert.Equal(actor, spy.ActorRequested);
        Assert.Equal(Permissions.FinanceView, permissions.LastRequested);
        Assert.NotNull(value); Assert.Equal(200, value.Total);
    }

    [Fact]
    public async Task ReceptionQueueCannotBeReadWithoutRevenuePermission()
    {
        var store = DispatchProxy.Create<IFinanceStore, StoreSpy>();
        var spy = (StoreSpy)store;
        var permissions = new PermissionStub(false);
        using var services = new ServiceCollection().AddApplication()
            .AddSingleton(store).AddSingleton<IPermissionService>(permissions)
            .AddSingleton<ICurrentUser>(new ActorStub(Guid.NewGuid())).BuildServiceProvider();
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => services.GetRequiredService<IFinanceQueries>().BillingQueueAsync(CancellationToken.None));
        Assert.Equal(Permissions.FinanceRevenueView, permissions.LastRequested);
        Assert.False(spy.QueueRequested);
    }

    private sealed record ActorStub(Guid? UserId) : ICurrentUser;
    private sealed class PermissionStub(bool allowed) : IPermissionService
    {
        public string? LastRequested { get; private set; }
        public Task<bool> HasPermissionAsync(string permission, CancellationToken cancellationToken) => Task.FromResult(allowed);
        public Task EnsurePermissionAsync(string permission, CancellationToken cancellationToken)
        {
            LastRequested = permission;
            return allowed ? Task.CompletedTask : Task.FromException(new ForbiddenAccessException("Denied"));
        }
    }
    public class StoreSpy : DispatchProxy
    {
        public Guid? ActorRequested { get; private set; }
        public bool QueueRequested { get; private set; }
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod?.Name == nameof(IFinanceStore.MyDuesAsync))
            {
                ActorRequested = (Guid)args![0]!;
                return Task.FromResult<DoctorDues?>(new(200, "EGP", 1));
            }
            if (targetMethod?.Name == nameof(IFinanceStore.BillingQueueAsync))
            {
                QueueRequested = true;
                return Task.FromResult<IReadOnlyCollection<BillingQueueItem>>([]);
            }
            throw new NotSupportedException(targetMethod?.Name);
        }
    }
}
