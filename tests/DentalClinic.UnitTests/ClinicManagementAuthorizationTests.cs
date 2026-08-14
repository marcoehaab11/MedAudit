using DentalClinic.Application;
using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Platform;
using DentalClinic.Application.Tenants;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.UnitTests;

public sealed class ClinicManagementAuthorizationTests
{
    [Fact]
    public async Task ClinicAdminCannotListTenants()
    {
        await using var provider = CreateProvider();
        var service = provider.GetRequiredService<IClinicManagementService>();

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            service.SearchAsync(new ClinicSearchQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task ClinicAdminCannotManageTenants()
    {
        await using var provider = CreateProvider();
        var service = provider.GetRequiredService<IClinicManagementService>();

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            service.ChangeStatusAsync(Guid.NewGuid(), TenantStatus.Suspended, CancellationToken.None));
    }

    private static ServiceProvider CreateProvider()
    {
        var services = new ServiceCollection();
        services.AddApplication();
        services.AddSingleton<IPlatformClinicStore, StubStore>();
        services.AddSingleton<IClinicAdminIdentityService, StubIdentity>();
        services.AddSingleton<IInvitationTokenGenerator, StubTokenGenerator>();
        services.AddSingleton<IClinicInvitationNotifier, StubNotifier>();
        services.AddSingleton<IPlatformAccessContext, DeniedAccess>();
        services.AddSingleton<ISystemClock, StubClock>();
        return services.BuildServiceProvider();
    }

    private sealed class DeniedAccess : IPlatformAccessContext
    {
        public bool IsPlatformAdmin => false;
        public Guid? UserId => Guid.NewGuid();
        public string? CorrelationId => "test";
    }

    private sealed class StubClock : ISystemClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }
    private sealed class StubTokenGenerator : IInvitationTokenGenerator { public string Generate() => "token"; }
    private sealed class StubIdentity : IClinicAdminIdentityService
    {
        public Task<Guid> CreateAdminAsync(Guid tenantId, string email, CancellationToken cancellationToken) =>
            Task.FromResult(Guid.NewGuid());
    }
    private sealed class StubNotifier : IClinicInvitationNotifier
    {
        public Task SendAsync(Guid invitationId, string email, string token, DateTimeOffset expiresAt, CancellationToken cancellationToken) => Task.CompletedTask;
    }
    private sealed class StubStore : IPlatformClinicStore
    {
        public Task<IPlatformTransaction> BeginTransactionAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<PagedResult<ClinicListItem>> SearchAsync(ClinicSearchQuery query, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<ClinicDetails?> GetDetailsAsync(Guid tenantId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<Tenant?> FindTenantAsync(Guid tenantId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> SlugExistsAsync(string slug, Guid? excludingTenantId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<AdminInvitation?> FindInvitationByTokenHashAsync(string tokenHash, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<TenantRole?> FindRoleByNameAsync(Guid tenantId, string normalizedName, CancellationToken cancellationToken) => throw new NotSupportedException();
        public void AddTenant(Tenant tenant) => throw new NotSupportedException();
        public void AddTenantConfiguration(TenantConfiguration configuration) => throw new NotSupportedException();
        public void AddInvitation(AdminInvitation invitation) => throw new NotSupportedException();
        public void AddAudit(PlatformAuditLog audit) => throw new NotSupportedException();
        public void AddClinicUser(ClinicUser user) => throw new NotSupportedException();
        public void AddTenantRole(TenantRole role) => throw new NotSupportedException();
        public void AddRolePermission(RolePermissionGrant permission) => throw new NotSupportedException();
        public void AddUserRole(UserRoleAssignment assignment) => throw new NotSupportedException();
        public Task SavePlatformChangesAsync(Guid tenantId, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
