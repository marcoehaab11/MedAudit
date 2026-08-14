using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Identity;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Common.Interfaces;

namespace DentalClinic.Application.Tenants;

internal sealed class CoreTenantInitializer(IPlatformClinicStore store, ISystemClock clock) : ITenantInitializer
{
    public Task InitializeAsync(Tenant tenant, CancellationToken cancellationToken)
    {
        store.AddTenantConfiguration(TenantConfiguration.CreateForTenant(
            tenant.Id,
            "en",
            tenant.TimeZone,
            tenant.Currency));

        foreach (var definition in SystemRoleDefinitions.Roles)
        {
            var role = new TenantRole(
                tenant.Id,
                definition.Key,
                $"Built-in {definition.Key} role.",
                true,
                clock.UtcNow);
            store.AddTenantRole(role);
            foreach (var permission in definition.Value)
            {
                store.AddRolePermission(new RolePermissionGrant(tenant.Id, role.Id, permission));
            }
        }

        return Task.CompletedTask;
    }
}
