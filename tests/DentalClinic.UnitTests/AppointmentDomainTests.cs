using DentalClinic.Domain.Appointments;

namespace DentalClinic.UnitTests;

public sealed class AppointmentDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public void AppointmentStartsScheduledWithUtcTiming()
    {
        var appointment = Create();

        Assert.Equal(AppointmentStatus.Scheduled, appointment.Status);
        Assert.Equal(Now.AddMinutes(30), appointment.EndAt);
        Assert.Equal(30, appointment.DurationMinutes);
    }

    [Fact]
    public void NonUtcAndInvalidDurationsAreRejected()
    {
        Assert.Throws<ArgumentException>(() => Create(new DateTimeOffset(2026, 8, 15, 9, 0, 0, TimeSpan.FromHours(2))));
        Assert.Throws<ArgumentOutOfRangeException>(() => Create(duration: 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => Create(duration: 481));
    }

    [Fact]
    public void HappyPathTransitionsAreExplicit()
    {
        var appointment = Create();

        appointment.Confirm(Now.AddMinutes(1));
        appointment.CheckIn(Now.AddMinutes(2));
        appointment.Start(Now.AddMinutes(3));
        appointment.Complete(Now.AddMinutes(4));

        Assert.Equal(AppointmentStatus.Completed, appointment.Status);
        Assert.Equal(Now.AddMinutes(4), appointment.CompletedAt);
        Assert.True(appointment.IsTerminal);
    }

    [Fact]
    public void InvalidTransitionIsRejected()
    {
        var appointment = Create();

        Assert.Throws<InvalidOperationException>(() => appointment.Start(Now.AddMinutes(1)));
        Assert.Throws<InvalidOperationException>(() => appointment.Complete(Now.AddMinutes(1)));
    }

    [Fact]
    public void CancelRequiresReasonAndIsTerminal()
    {
        var appointment = Create();

        Assert.Throws<ArgumentException>(() => appointment.Cancel(" ", Now.AddMinutes(1)));
        appointment.Cancel("Patient requested cancellation", Now.AddMinutes(2));

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
        Assert.True(appointment.IsTerminal);
        Assert.Throws<InvalidOperationException>(() => appointment.Confirm(Now.AddMinutes(3)));
    }

    [Fact]
    public void NoShowAndRescheduleRulesAreEnforced()
    {
        var appointment = Create();
        appointment.Reschedule(Now.AddHours(1), 60, Now.AddMinutes(1));
        appointment.MarkNoShow(Now.AddHours(2));

        Assert.Equal(Now.AddHours(1), appointment.StartAt);
        Assert.Equal(AppointmentStatus.NoShow, appointment.Status);
        Assert.Throws<InvalidOperationException>(() => appointment.Reschedule(Now, 30, Now));
    }

    private static Appointment Create(DateTimeOffset? start = null, int duration = 30) => new(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), AppointmentType.Consultation,
        start ?? Now, duration, "Notes", Guid.NewGuid(), Now);
}
