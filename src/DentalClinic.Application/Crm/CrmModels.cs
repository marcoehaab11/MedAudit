using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.Crm;

public enum FollowUpSortField { DueAt = 1, CreatedAt = 2, Patient = 3, Status = 4 }
public sealed record FollowUpInput(Guid PatientId, Guid AssignedToUserId, FollowUpType Type, DateOnly DueDate,
    TimeOnly DueTime, string Title, string? Notes, Guid? RelatedAppointmentId = null,
    Guid? RelatedTreatmentPlanId = null, Guid? RelatedTreatmentId = null, Guid? RelatedPrescriptionId = null);
public sealed record FollowUpCreationRequest(Guid PatientId, FollowUpType Type, DateTimeOffset DueAt,
    string Title, Guid? AssignedToUserId = null, string? Notes = null, Guid? RelatedAppointmentId = null,
    Guid? RelatedTreatmentPlanId = null, Guid? RelatedTreatmentId = null, Guid? RelatedPrescriptionId = null);
public sealed record UpdateFollowUpCommand(Guid Id, FollowUpInput Input, Guid Version);
public sealed record FollowUpSearch(string? Search = null, FollowUpStatus? Status = null, FollowUpType? Type = null,
    Guid? AssignedToUserId = null, Guid? PatientId = null, DateOnly? DueFrom = null, DateOnly? DueTo = null,
    bool? Overdue = null, FollowUpSortField SortBy = FollowUpSortField.DueAt, bool Descending = false,
    int Page = 1, int PageSize = 20);
public sealed record FollowUpStoreSearch(string? Search, FollowUpStatus? Status, FollowUpType? Type,
    Guid? AssignedToUserId, Guid? PatientId, DateTimeOffset? DueFrom, DateTimeOffset? DueTo,
    bool? Overdue, DateTimeOffset Now, string TimeZone, FollowUpSortField SortBy, bool Descending, int Page, int PageSize);
public sealed record FollowUpListItem(Guid Id, Guid PatientId, string PatientName, Guid AssignedToUserId,
    string AssignedToName, FollowUpType Type, FollowUpStatus Status, DateTimeOffset DueAt, bool IsOverdue,
    string Title, DateTimeOffset CreatedAt, DateTimeOffset? CompletedAt, Guid Version, string TimeZone);
public sealed record FollowUpDetails(Guid Id, Guid PatientId, string PatientName, Guid AssignedToUserId,
    string AssignedToName, Guid CreatedByUserId, FollowUpType Type, FollowUpStatus Status, DateTimeOffset DueAt,
    bool IsOverdue, string Title, string? Notes, Guid? RelatedAppointmentId, Guid? RelatedTreatmentPlanId,
    Guid? RelatedTreatmentId, Guid? RelatedPrescriptionId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt, Guid Version, string TimeZone);
public sealed record CrmDashboard(int NewPatientsToday, int NewPatientsThisWeek, int NewPatientsThisMonth,
    int PendingFollowUps, int OverdueFollowUps, int CompletedFollowUps, int TodayFollowUps, string TimeZone);
public sealed record CrmPatientLifecycle(Guid PatientId, bool IsNew, PatientStatus Status,
    int PendingFollowUps, IReadOnlyCollection<FollowUpListItem> RecentFollowUps,
    IReadOnlyCollection<CommunicationActivityItem> RecentActivities, string TimeZone);
public sealed record CommunicationActivityInput(Guid PatientId, CommunicationType Type,
    CommunicationDirection Direction, string? Subject, string? Notes, DateOnly OccurredDate, TimeOnly OccurredTime);
public sealed record CommunicationActivityItem(Guid Id, Guid PatientId, string PatientName, Guid UserId,
    string UserName, CommunicationType Type, CommunicationDirection Direction, string? Subject, string? Notes,
    DateTimeOffset OccurredAt, DateTimeOffset CreatedAt);
public sealed record CrmUserOption(Guid Id, string DisplayName);
public sealed record CrmRelation(Guid Id, Guid PatientId);
public sealed record CrmPatient(Guid Id, PatientStatus Status, DateTimeOffset CreatedAt);
public sealed record CrmUser(Guid Id, bool IsActive);
public sealed class CrmNotFoundException(string message) : Exception(message);
