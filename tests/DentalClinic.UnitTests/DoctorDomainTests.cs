using DentalClinic.Domain.Doctors;

namespace DentalClinic.UnitTests;

public sealed class DoctorDomainTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void ProfileNormalizesFieldsAndStartsActive()
    {
        var profile = new DoctorProfile(TenantId, UserId, " General dentistry ", " lic-42 ",
            " Biography ", 30, Now);

        Assert.Equal(TenantId, profile.TenantId);
        Assert.Equal(UserId, profile.ClinicUserId);
        Assert.Equal("General dentistry", profile.Specialization);
        Assert.Equal("LIC-42", profile.LicenseNumber);
        Assert.Equal(DoctorProfileStatus.Active, profile.Status);
    }

    [Fact]
    public void ArchivedProfileCannotBeChangedOrReactivated()
    {
        var profile = Profile();
        profile.Archive(Now.AddMinutes(1));

        Assert.Throws<InvalidOperationException>(() => profile.Update("Surgery", "LIC-43", null, 45, Now.AddMinutes(2)));
        Assert.Throws<InvalidOperationException>(() => profile.Activate(Now.AddMinutes(2)));
    }

    [Fact]
    public void ScheduleRejectsInvalidSlotsAndOverlappingBreaks()
    {
        Assert.Throws<ArgumentException>(() => Schedule(50, []));
        Assert.Throws<ArgumentException>(() => Schedule(30,
            [(new TimeOnly(10, 0), new TimeOnly(10, 30)), (new TimeOnly(10, 15), new TimeOnly(10, 45))]));
    }

    [Fact]
    public void WeeklyPeriodsCannotOverlapForTheSameDay()
    {
        var first = Schedule(30, []);
        var second = new DoctorSchedule(TenantId, Guid.NewGuid(), DayOfWeek.Monday,
            new TimeOnly(16, 30), new TimeOnly(18, 0), 30, [], Now);

        Assert.Throws<ArgumentException>(() => DoctorSchedule.EnsureNoOverlappingPeriods([first, second]));
    }

    [Fact]
    public void CompensationValuesMustMatchType()
    {
        Assert.Throws<ArgumentException>(() => Compensation(CompensationType.FixedSalary, null, null));
        Assert.Throws<ArgumentException>(() => Compensation(CompensationType.Percentage, 500, 10));
        Assert.Throws<ArgumentOutOfRangeException>(() => Compensation(CompensationType.Percentage, null, 101));

        var combined = Compensation(CompensationType.FixedSalaryAndPercentage, 500, 10);
        Assert.Equal(500, combined.FixedAmount);
        Assert.Equal(10, combined.Percentage);
    }

    [Fact]
    public void ClosedCompensationHistoryCannotBeExtended()
    {
        var compensation = Compensation(CompensationType.FixedSalary, 1_000, null,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31));
        compensation.Close(new DateOnly(2026, 6, 30), Now.AddMinutes(1));

        Assert.Throws<InvalidOperationException>(() =>
            compensation.Close(new DateOnly(2026, 7, 31), Now.AddMinutes(2)));
    }

    private static DoctorProfile Profile() =>
        new(TenantId, UserId, "General dentistry", "LIC-42", null, 30, Now);

    private static DoctorSchedule Schedule(int slotDuration,
        IReadOnlyCollection<(TimeOnly Start, TimeOnly End)> breaks) =>
        new(TenantId, Guid.NewGuid(), DayOfWeek.Monday, new TimeOnly(9, 0),
            new TimeOnly(17, 0), slotDuration, breaks, Now);

    private static DoctorCompensation Compensation(CompensationType type, decimal? fixedAmount,
        decimal? percentage, DateOnly? from = null, DateOnly? to = null) =>
        new(TenantId, Guid.NewGuid(), type, fixedAmount, percentage,
            from ?? new DateOnly(2026, 1, 1), to, Now);
}
