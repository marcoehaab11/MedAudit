using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Tenancy;

namespace DentalClinic.UnitTests;

public sealed class ClinicAppointmentScheduleTests
{
    [Fact]
    public void ConfiguredClinicHoursReplaceDoctorSlotGridAndClosedDaysStayClosed()
    {
        var tenant = Guid.NewGuid(); var doctor = Guid.NewGuid();
        var monday = new ClinicHours(tenant, DayOfWeek.Monday, true);
        monday.SetPeriods([new ClinicHourPeriod(new(9, 0), new(12, 0), ClinicPeriodType.Work),
            new ClinicHourPeriod(new(12, 0), new(13, 0), ClinicPeriodType.Break),
            new ClinicHourPeriod(new(13, 0), new(17, 0), ClinicPeriodType.Work)]);
        var tuesday = new ClinicHours(tenant, DayOfWeek.Tuesday, false);
        var result = ClinicAppointmentSchedule.Resolve(tenant, doctor, [monday, tuesday], []);
        Assert.Equal(2, result.Count);
        Assert.All(result, x => Assert.Equal(DayOfWeek.Monday, x.DayOfWeek));
        Assert.Equal(new TimeOnly(12, 0), result.First().EndTime);
        Assert.Equal(new TimeOnly(13, 0), result.Last().StartTime);
    }

    [Fact]
    public void DoctorHoursAndBreaksAreRespectedInsideClinicHours()
    {
        var tenant = Guid.NewGuid(); var doctor = Guid.NewGuid();
        var day = new ClinicHours(tenant, DayOfWeek.Monday, true);
        day.SetPeriods([new ClinicHourPeriod(new(9, 0), new(17, 0), ClinicPeriodType.Work)]);
        var shift = new DoctorSchedule(tenant, doctor, DayOfWeek.Monday, new(10, 0), new(14, 0), 60,
            [(new TimeOnly(11, 0), new TimeOnly(12, 0))], DateTimeOffset.UtcNow);
        var result = Assert.Single(ClinicAppointmentSchedule.Resolve(tenant, doctor, [day], [shift]));
        Assert.Equal(new TimeOnly(10, 0), result.StartTime); Assert.Equal(new TimeOnly(14, 0), result.EndTime);
        Assert.Single(result.Breaks);
    }

    [Fact]
    public void ExistingDoctorScheduleRemainsUntilClinicHoursAreConfigured()
    {
        var tenant = Guid.NewGuid(); var doctor = Guid.NewGuid();
        var fallback = new DoctorSchedule(tenant, doctor, DayOfWeek.Monday, new(9, 0), new(17, 0), 60, [], DateTimeOffset.UtcNow);
        var result = ClinicAppointmentSchedule.Resolve(tenant, doctor, [], [fallback]);
        Assert.Same(fallback, Assert.Single(result));
    }
}
