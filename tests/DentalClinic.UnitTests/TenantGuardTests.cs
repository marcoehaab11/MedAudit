using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Common.Security;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class TenantGuardTests
{
    [Fact]
    public void MatchingTenantIsAllowed()
    {
        var tenantId = Guid.NewGuid();
        var guard = CreateGuard(tenantId);

        guard.EnsureOwnedByCurrentTenant(tenantId);
    }

    [Fact]
    public void DifferentTenantIsRejected()
    {
        var guard = CreateGuard(Guid.NewGuid());

        Assert.Throws<ForbiddenAccessException>(() =>
            guard.EnsureOwnedByCurrentTenant(Guid.NewGuid()));
    }

    [Fact]
    public void MissingTenantIsRejected()
    {
        var guard = CreateGuard(null);

        Assert.Throws<TenantUnavailableException>(() =>
            guard.EnsureOwnedByCurrentTenant(Guid.NewGuid()));
    }

    private static ITenantGuard CreateGuard(Guid? tenantId)
    {
        var services = new ServiceCollection();
        services.AddSingleton<ICurrentTenant>(new TestTenant(tenantId));
        services.AddApplication();
        return services.BuildServiceProvider().GetRequiredService<ITenantGuard>();
    }

    private sealed class TestTenant(Guid? tenantId) : ICurrentTenant
    {
        public Guid? TenantId { get; } = tenantId;
        public bool IsAvailable => TenantId.HasValue;
        public Guid RequireTenantId() => TenantId ?? throw new TenantUnavailableException();
    }
}
