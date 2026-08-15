using DentalClinic.Domain.Crm;

namespace DentalClinic.UnitTests;

public sealed class CrmDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Patient = Guid.NewGuid();
    private static readonly Guid User = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PendingCanStartAndComplete()
    { var x = Create(); x.Start(x.Version, Now); x.Complete(x.Version, Now.AddMinutes(1)); Assert.Equal(FollowUpStatus.Completed, x.Status); Assert.NotNull(x.CompletedAt); }

    [Fact]
    public void PendingCanCompleteOrCancelDirectly()
    { var complete = Create(); complete.Complete(complete.Version, Now); var cancel = Create(); cancel.Cancel(cancel.Version, Now); Assert.Equal(FollowUpStatus.Completed, complete.Status); Assert.Equal(FollowUpStatus.Cancelled, cancel.Status); }

    [Fact]
    public void TerminalFollowUpsCannotBeReopenedOrEdited()
    { var x = Create(); x.Complete(x.Version, Now); Assert.Throws<FollowUpStateException>(() => x.Start(x.Version, Now)); Assert.Throws<FollowUpStateException>(() => x.Update(FollowUpType.General, Now.AddDays(1), "Changed", null, null, null, null, null, x.Version, Now)); }

    [Fact]
    public void OverdueIsDerivedOnlyForOpenFollowUps()
    { var x = Create(Now.AddMinutes(-1)); Assert.True(x.IsOverdue(Now)); x.Complete(x.Version, Now); Assert.False(x.IsOverdue(Now.AddDays(1))); }

    [Fact]
    public void StaleAssignmentIsRejected()
    { var x = Create(); var stale = x.Version; x.Assign(Guid.NewGuid(), x.Version, Now); Assert.Throws<FollowUpConcurrencyException>(() => x.Assign(Guid.NewGuid(), stale, Now)); }

    [Fact]
    public void InvalidRelatedIdsAndCommunicationValuesAreRejected()
    { Assert.Throws<ArgumentException>(() => new FollowUp(Tenant, Patient, User, User, FollowUpType.General, Now, "Title", null, Guid.Empty, null, null, null, Now)); Assert.Throws<ArgumentOutOfRangeException>(() => new CommunicationActivity(Tenant, Patient, User, (CommunicationType)99, CommunicationDirection.Outbound, null, null, Now, Now)); }

    private static FollowUp Create(DateTimeOffset? due = null) => new(Tenant, Patient, User, User,
        FollowUpType.General, due ?? Now.AddDays(1), "Check patient", null, null, null, null, null, Now);
}
