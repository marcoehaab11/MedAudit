using DentalClinic.Domain.Tenancy;

namespace DentalClinic.UnitTests;

public sealed class AdminInvitationTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void InvitationCanOnlyBeAcceptedOnce()
    {
        var invitation = CreateInvitation(Now.AddHours(2));

        Assert.True(invitation.TryAccept(Now.AddMinutes(1)));
        Assert.False(invitation.TryAccept(Now.AddMinutes(2)));
        Assert.Equal(AdminInvitationStatus.Accepted, invitation.Status);
    }

    [Fact]
    public void ExpiredInvitationCannotBeAccepted()
    {
        var invitation = CreateInvitation(Now.AddHours(2));

        Assert.False(invitation.TryAccept(Now.AddHours(2)));
        Assert.Equal(AdminInvitationStatus.Expired, invitation.Status);
        Assert.Null(invitation.AcceptedAt);
    }

    private static AdminInvitation CreateInvitation(DateTimeOffset expiresAt) =>
        new(Guid.NewGuid(), Guid.NewGuid(), "admin@example.com", "ClinicAdmin",
            new string('a', 64), expiresAt, Now);
}
