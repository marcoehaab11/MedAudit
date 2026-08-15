using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Crm;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Crm;

public interface ICrmStore
{
    Task<string> GetTimeZoneAsync(CancellationToken token);
    Task<CrmPatient?> FindPatientAsync(Guid id, CancellationToken token);
    Task<CrmUser?> FindUserAsync(Guid id, CancellationToken token);
    Task<CrmRelation?> FindAppointmentAsync(Guid id, CancellationToken token);
    Task<CrmRelation?> FindTreatmentPlanAsync(Guid id, CancellationToken token);
    Task<CrmRelation?> FindTreatmentAsync(Guid id, CancellationToken token);
    Task<CrmRelation?> FindPrescriptionAsync(Guid id, CancellationToken token);
    Task<FollowUp?> FindFollowUpAsync(Guid id, bool tracking, CancellationToken token);
    Task<FollowUpDetails?> GetFollowUpAsync(Guid id, DateTimeOffset now, string timeZone, CancellationToken token);
    Task<PagedResult<FollowUpListItem>> SearchFollowUpsAsync(FollowUpStoreSearch search, CancellationToken token);
    Task<CrmDashboard> GetDashboardAsync(DateTimeOffset todayStart, DateTimeOffset tomorrowStart,
        DateTimeOffset weekStart, DateTimeOffset monthStart, DateTimeOffset now, string timeZone, CancellationToken token);
    Task<CrmPatientLifecycle?> GetPatientSummaryAsync(Guid patientId, DateTimeOffset newSince,
        DateTimeOffset now, string timeZone, CancellationToken token);
    Task<IReadOnlyCollection<CommunicationActivityItem>> GetActivitiesAsync(Guid patientId, int take, CancellationToken token);
    Task<IReadOnlyCollection<CrmUserOption>> GetAssignableUsersAsync(CancellationToken token);
    void AddFollowUp(FollowUp item);
    void AddActivity(CommunicationActivity item);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken token);
}

public interface IFollowUpQueries
{
    Task<CrmDashboard> DashboardAsync(CancellationToken token);
    Task<PagedResult<FollowUpListItem>> SearchAsync(FollowUpSearch search, CancellationToken token);
    Task<FollowUpDetails?> GetAsync(Guid id, CancellationToken token);
    Task<CrmPatientLifecycle?> PatientSummaryAsync(Guid patientId, CancellationToken token);
    Task<IReadOnlyCollection<CrmUserOption>> AssignableUsersAsync(CancellationToken token);
}
public interface ICreateFollowUp { Task<Guid> ExecuteAsync(FollowUpInput input, CancellationToken token); }
public interface IUpdateFollowUp { Task<bool> ExecuteAsync(UpdateFollowUpCommand command, CancellationToken token); }
public interface IAssignFollowUp { Task<bool> ExecuteAsync(Guid id, Guid assignedToUserId, Guid version, CancellationToken token); }
public interface IFollowUpLifecycle { Task<bool> ExecuteAsync(Guid id, string action, Guid version, CancellationToken token); }
public interface ICommunicationActivityService
{
    Task<IReadOnlyCollection<CommunicationActivityItem>> GetAsync(Guid patientId, int take, CancellationToken token);
    Task<Guid> CreateAsync(CommunicationActivityInput input, CancellationToken token);
}
public interface IFollowUpCreator { Task<Guid> CreateAsync(FollowUpCreationRequest request, CancellationToken token); }
