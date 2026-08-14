using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;

namespace DentalClinic.UnitTests;

public sealed class IdentityDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void InvitedUserActivatesOnlyThroughInvitationAcceptance()
    {
        var user = new ClinicUser(Guid.NewGuid(), Guid.NewGuid(), "Dr Sara", null, Now);

        Assert.Throws<InvalidOperationException>(() => user.Activate(Now.AddMinutes(1)));
        user.AcceptInvitation(Now.AddMinutes(2));

        Assert.Equal(UserStatus.Active, user.Status);
    }

    [Fact]
    public void ActiveUserCanBeDeactivatedAndReactivated()
    {
        var user = new ClinicUser(Guid.NewGuid(), Guid.NewGuid(), "Reception", null, Now);
        user.AcceptInvitation(Now.AddMinutes(1));
        user.Deactivate(Now.AddMinutes(2));
        Assert.Equal(UserStatus.Inactive, user.Status);
        user.Activate(Now.AddMinutes(3));
        Assert.Equal(UserStatus.Active, user.Status);
    }

    [Fact]
    public void SystemRoleCannotBeRenamed()
    {
        var role = new TenantRole(Guid.NewGuid(), "Doctor", "Built-in doctor role.", true, Now);
        Assert.Throws<InvalidOperationException>(() => role.Update("Owner", "Changed", Now.AddMinutes(1)));
    }

    [Fact]
    public void PermissionEvaluationReturnsDistinctEffectivePermissions()
    {
        var result = PermissionSetEvaluator.Resolve(
        [
            new[] { Permissions.PatientsView, Permissions.DentalView },
            new[] { Permissions.PatientsView, Permissions.PrescriptionsCreate }
        ]);

        Assert.Equal(3, result.Count);
        Assert.Contains(Permissions.PrescriptionsCreate, result);
        Assert.DoesNotContain(Permissions.FinanceView, result);
    }

    [Fact]
    public void PlatformAdminIsNotATenantAssignablePermission()
    {
        Assert.DoesNotContain("PlatformAdmin", Permissions.All);
    }
}
