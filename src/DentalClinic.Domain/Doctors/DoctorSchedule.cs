using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Doctors;

public sealed class DoctorSchedule : TenantOwnedEntity
{
    private readonly List<DoctorScheduleBreak> breaks = [];
    private DoctorSchedule() { }

    public DoctorSchedule(Guid tenantId, Guid doctorProfileId, DayOfWeek dayOfWeek,
        TimeOnly startTime, TimeOnly endTime, int slotDurationMinutes,
        IReadOnlyCollection<(TimeOnly Start, TimeOnly End)> scheduleBreaks, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || doctorProfileId == Guid.Empty) throw new ArgumentException("Tenant and doctor IDs are required.");
        TenantId = tenantId; DoctorProfileId = doctorProfileId;
        Apply(dayOfWeek, startTime, endTime, slotDurationMinutes, scheduleBreaks);
        CreatedAt = createdAt; UpdatedAt = createdAt;
    }

    public Guid DoctorProfileId { get; private set; }
    public DayOfWeek DayOfWeek { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public int SlotDurationMinutes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public IReadOnlyCollection<DoctorScheduleBreak> Breaks => breaks;

    public void Update(DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime,
        int slotDurationMinutes, IReadOnlyCollection<(TimeOnly Start, TimeOnly End)> scheduleBreaks,
        DateTimeOffset updatedAt)
    { Apply(dayOfWeek, startTime, endTime, slotDurationMinutes, scheduleBreaks); UpdatedAt = updatedAt; }

    public static void EnsureNoOverlappingPeriods(IEnumerable<DoctorSchedule> periods)
    {
        foreach (var day in periods.GroupBy(x => x.DayOfWeek))
        {
            DoctorSchedule? previous = null;
            foreach (var period in day.OrderBy(x => x.StartTime))
            {
                if (previous is not null && period.StartTime < previous.EndTime)
                    throw new ArgumentException("Working periods cannot overlap.");
                previous = period;
            }
        }
    }

    private void Apply(DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime,
        int slotDurationMinutes, IReadOnlyCollection<(TimeOnly Start, TimeOnly End)> scheduleBreaks)
    {
        if (!Enum.IsDefined(dayOfWeek)) throw new ArgumentOutOfRangeException(nameof(dayOfWeek));
        if (startTime >= endTime) throw new ArgumentException("Schedule start must be before end.");
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(slotDurationMinutes);
        var workingMinutes = (int)(endTime - startTime).TotalMinutes;
        if (slotDurationMinutes > workingMinutes || workingMinutes % slotDurationMinutes != 0)
            throw new ArgumentException("Slot duration must fit evenly inside the working period.");
        var ordered = scheduleBreaks.OrderBy(x => x.Start).ToArray();
        for (var index = 0; index < ordered.Length; index++)
        {
            var item = ordered[index];
            if (item.Start < startTime || item.End > endTime || item.Start >= item.End)
                throw new ArgumentException("Breaks must be valid and inside working hours.");
            if (index > 0 && item.Start < ordered[index - 1].End)
                throw new ArgumentException("Schedule breaks cannot overlap.");
        }
        DayOfWeek = dayOfWeek; StartTime = startTime; EndTime = endTime; SlotDurationMinutes = slotDurationMinutes;
        breaks.Clear();
        breaks.AddRange(ordered.Select(x => new DoctorScheduleBreak(TenantId, Id, x.Start, x.End)));
    }
}
