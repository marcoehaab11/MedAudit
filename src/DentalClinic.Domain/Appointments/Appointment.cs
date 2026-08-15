using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Appointments;

public sealed class Appointment : TenantOwnedEntity
{
    private Appointment() { }

    public Appointment(Guid tenantId, Guid patientId, Guid doctorProfileId, AppointmentType type,
        DateTimeOffset startAt, int durationMinutes, string? notes, Guid createdBy, DateTimeOffset createdAt,
        string? bookingReference = null, Guid? treatmentCatalogItemId = null)
    {
        if (tenantId == Guid.Empty || patientId == Guid.Empty || doctorProfileId == Guid.Empty || createdBy == Guid.Empty)
            throw new ArgumentException("Tenant, patient, doctor, and creator IDs are required.");
        TenantId = tenantId;
        PatientId = patientId;
        DoctorProfileId = doctorProfileId;
        CreatedBy = createdBy;
        ApplyTiming(startAt, durationMinutes);
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        Type = type;
        Notes = NormalizeOptional(notes, nameof(notes), 2000);
        BookingReference = NormalizeOptional(bookingReference, nameof(bookingReference), 50);
        TreatmentCatalogItemId = treatmentCatalogItemId == Guid.Empty ? null : treatmentCatalogItemId;
        Status = AppointmentStatus.Scheduled;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public Guid PatientId { get; private set; }
    public Guid DoctorProfileId { get; private set; }
    public AppointmentType Type { get; private set; }
    public AppointmentStatus Status { get; private set; }
    public DateTimeOffset StartAt { get; private set; }
    public DateTimeOffset EndAt { get; private set; }
    public int DurationMinutes { get; private set; }
    public string? Notes { get; private set; }
    public string? CancellationReason { get; private set; }
    public string? BookingReference { get; private set; }
    public Guid? TreatmentCatalogItemId { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ConfirmedAt { get; private set; }
    public DateTimeOffset? CheckedInAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }

    public bool IsTerminal => Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled or AppointmentStatus.NoShow;

    public void Reschedule(DateTimeOffset startAt, int durationMinutes, DateTimeOffset updatedAt)
    {
        if (Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
            throw new InvalidOperationException("Only scheduled or confirmed appointments can be rescheduled.");
        ApplyTiming(startAt, durationMinutes);
        UpdatedAt = updatedAt;
    }

    public void Confirm(DateTimeOffset occurredAt)
    {
        EnsureStatus(AppointmentStatus.Scheduled);
        Status = AppointmentStatus.Confirmed;
        ConfirmedAt = occurredAt;
        UpdatedAt = occurredAt;
    }

    public void Cancel(string reason, DateTimeOffset occurredAt)
    {
        if (Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed or AppointmentStatus.CheckedIn))
            throw new InvalidOperationException("This appointment cannot be cancelled in its current status.");
        CancellationReason = NormalizeRequired(reason, nameof(reason), 500);
        Status = AppointmentStatus.Cancelled;
        CancelledAt = occurredAt;
        UpdatedAt = occurredAt;
    }

    public void CheckIn(DateTimeOffset occurredAt)
    {
        EnsureStatus(AppointmentStatus.Confirmed);
        Status = AppointmentStatus.CheckedIn;
        CheckedInAt = occurredAt;
        UpdatedAt = occurredAt;
    }

    public void Start(DateTimeOffset occurredAt)
    {
        EnsureStatus(AppointmentStatus.CheckedIn);
        Status = AppointmentStatus.InProgress;
        UpdatedAt = occurredAt;
    }

    public void Complete(DateTimeOffset occurredAt)
    {
        EnsureStatus(AppointmentStatus.InProgress);
        Status = AppointmentStatus.Completed;
        CompletedAt = occurredAt;
        UpdatedAt = occurredAt;
    }

    public void MarkNoShow(DateTimeOffset occurredAt)
    {
        if (Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
            throw new InvalidOperationException("Only scheduled or confirmed appointments can be marked as no-show.");
        Status = AppointmentStatus.NoShow;
        UpdatedAt = occurredAt;
    }

    private void ApplyTiming(DateTimeOffset startAt, int durationMinutes)
    {
        if (startAt.Offset != TimeSpan.Zero)
            throw new ArgumentException("Appointment timestamps must be supplied in UTC.", nameof(startAt));
        if (durationMinutes is < 5 or > 480)
            throw new ArgumentOutOfRangeException(nameof(durationMinutes), "Duration must be between 5 and 480 minutes.");
        StartAt = startAt;
        DurationMinutes = durationMinutes;
        EndAt = startAt.AddMinutes(durationMinutes);
    }

    private void EnsureStatus(AppointmentStatus expected)
    {
        if (Status != expected)
            throw new InvalidOperationException($"Appointment must be {expected} for this transition.");
    }

    private static string NormalizeRequired(string value, string parameterName, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameterName);
        var normalized = value.Trim();
        return normalized.Length <= maximumLength
            ? normalized
            : throw new ArgumentException($"Value cannot exceed {maximumLength} characters.", parameterName);
    }

    private static string? NormalizeOptional(string? value, string parameterName, int maximumLength) =>
        string.IsNullOrWhiteSpace(value) ? null : NormalizeRequired(value, parameterName, maximumLength);
}
