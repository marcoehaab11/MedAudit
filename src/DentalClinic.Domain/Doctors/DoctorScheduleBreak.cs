using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Doctors;

public sealed class DoctorScheduleBreak : TenantOwnedEntity
{
    private DoctorScheduleBreak() { }
    internal DoctorScheduleBreak(Guid tenantId, Guid scheduleId, TimeOnly startTime, TimeOnly endTime)
    {
        if (tenantId == Guid.Empty || scheduleId == Guid.Empty) throw new ArgumentException("Tenant and schedule IDs are required.");
        if (startTime >= endTime) throw new ArgumentException("Break start must be before break end.");
        TenantId = tenantId; DoctorScheduleId = scheduleId; StartTime = startTime; EndTime = endTime;
    }
    public Guid DoctorScheduleId { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
}
