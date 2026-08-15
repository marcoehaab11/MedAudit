using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public enum ClinicPeriodType
{
    Work = 1,
    Break = 2
}

public sealed class ClinicHours : TenantOwnedEntity
{
    private readonly List<ClinicHourPeriod> _periods = [];

    private ClinicHours() { }

    public ClinicHours(Guid tenantId, DayOfWeek dayOfWeek, bool isOpen)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        TenantId = tenantId;
        DayOfWeek = dayOfWeek;
        IsOpen = isOpen;
    }

    public DayOfWeek DayOfWeek { get; private set; }
    public bool IsOpen { get; private set; }

    public IReadOnlyCollection<ClinicHourPeriod> Periods => _periods.AsReadOnly();

    public void UpdateStatus(bool isOpen)
    {
        IsOpen = isOpen;
    }

    public void SetPeriods(IEnumerable<ClinicHourPeriod> newPeriods)
    {
        var periodList = newPeriods.ToList();

        // Validate non-overlapping periods
        for (int i = 0; i < periodList.Count; i++)
        {
            for (int j = i + 1; j < periodList.Count; j++)
            {
                if (periodList[i].Overlaps(periodList[j]))
                {
                    throw new ArgumentException($"Period {periodList[i].StartTime}-{periodList[i].EndTime} overlaps with {periodList[j].StartTime}-{periodList[j].EndTime}.");
                }
            }
        }

        _periods.Clear();
        _periods.AddRange(periodList);
    }
}

public sealed class ClinicHourPeriod : Entity
{
    private ClinicHourPeriod() { }

    public ClinicHourPeriod(TimeOnly startTime, TimeOnly endTime, ClinicPeriodType periodType)
    {
        if (startTime >= endTime)
        {
            throw new ArgumentException($"Start time ({startTime}) must be strictly earlier than end time ({endTime}).");
        }

        StartTime = startTime;
        EndTime = endTime;
        PeriodType = periodType;
    }

    public Guid ClinicHoursId { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public ClinicPeriodType PeriodType { get; private set; }

    public bool Overlaps(ClinicHourPeriod other)
    {
        return StartTime < other.EndTime && EndTime > other.StartTime;
    }
}
