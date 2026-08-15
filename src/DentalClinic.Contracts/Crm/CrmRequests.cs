namespace DentalClinic.Contracts.Crm;

public sealed record FollowUpRequest(Guid PatientId, Guid AssignedToUserId, int Type, DateOnly DueDate,
    TimeOnly DueTime, string Title, string? Notes, Guid? RelatedAppointmentId, Guid? RelatedTreatmentPlanId,
    Guid? RelatedTreatmentId, Guid? RelatedPrescriptionId);
public sealed record UpdateFollowUpRequest(FollowUpRequest FollowUp, Guid Version);
public sealed record AssignFollowUpRequest(Guid AssignedToUserId, Guid Version);
public sealed record FollowUpActionRequest(Guid Version);
public sealed record CommunicationActivityRequest(Guid PatientId, int Type, int Direction, string? Subject,
    string? Notes, DateOnly OccurredDate, TimeOnly OccurredTime);
