using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed class ClinicHoliday : TenantOwnedEntity
{
    private ClinicHoliday() { }

    public ClinicHoliday(
        Guid tenantId,
        string name,
        string? arabicName,
        DateOnly startDate,
        DateOnly endDate,
        TimeOnly? startTime,
        TimeOnly? endTime,
        string? reason,
        bool isFullDay,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Holiday name is required.", nameof(name));

        if (startDate > endDate)
            throw new ArgumentException($"Start date ({startDate}) cannot be later than end date ({endDate}).");

        if (startDate == endDate && !isFullDay && startTime.HasValue && endTime.HasValue && startTime.Value >= endTime.Value)
        {
            throw new ArgumentException($"Start time ({startTime}) must be strictly earlier than end time ({endTime}).");
        }

        TenantId = tenantId;
        Name = name.Trim();
        ArabicName = string.IsNullOrWhiteSpace(arabicName) ? null : arabicName.Trim();
        StartDate = startDate;
        EndDate = endDate;
        StartTime = isFullDay ? null : startTime;
        EndTime = isFullDay ? null : endTime;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        IsFullDay = isFullDay;
        IsActive = true;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string Name { get; private set; } = string.Empty;
    public string? ArabicName { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }
    public TimeOnly? StartTime { get; private set; }
    public TimeOnly? EndTime { get; private set; }
    public string? Reason { get; private set; }
    public bool IsFullDay { get; private set; } = true;
    public bool IsActive { get; private set; } = true;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(
        string name,
        string? arabicName,
        DateOnly startDate,
        DateOnly endDate,
        TimeOnly? startTime,
        TimeOnly? endTime,
        string? reason,
        bool isFullDay,
        bool isActive,
        DateTimeOffset updatedAt)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Holiday name is required.", nameof(name));

        if (startDate > endDate)
            throw new ArgumentException($"Start date ({startDate}) cannot be later than end date ({endDate}).");

        if (startDate == endDate && !isFullDay && startTime.HasValue && endTime.HasValue && startTime.Value >= endTime.Value)
        {
            throw new ArgumentException($"Start time ({startTime}) must be strictly earlier than end time ({endTime}).");
        }

        Name = name.Trim();
        ArabicName = string.IsNullOrWhiteSpace(arabicName) ? null : arabicName.Trim();
        StartDate = startDate;
        EndDate = endDate;
        StartTime = isFullDay ? null : startTime;
        EndTime = isFullDay ? null : endTime;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        IsFullDay = isFullDay;
        IsActive = isActive;
        UpdatedAt = updatedAt;
    }

    public void Deactivate(DateTimeOffset updatedAt)
    {
        IsActive = false;
        UpdatedAt = updatedAt;
    }
}
