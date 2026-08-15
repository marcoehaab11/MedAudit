using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Treatments;

public interface ITreatmentStore
{
    Task<TreatmentPatient?> FindPatientAsync(Guid id, CancellationToken token);
    Task<TreatmentDoctor?> FindDoctorAsync(Guid id, CancellationToken token);
    Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken token);
    Task<TreatmentAppointment?> FindAppointmentAsync(Guid id, CancellationToken token);
    Task<DentalProcedureReference?> FindDentalProcedureAsync(Guid id, CancellationToken token);
    Task<TreatmentCatalogItem?> FindCatalogAsync(Guid id, bool tracking, CancellationToken token);
    Task<IReadOnlyCollection<CatalogItemDetails>> GetCatalogAsync(bool includeInactive, CancellationToken token);
    Task<bool> CatalogCodeExistsAsync(string code, Guid? excludeId, CancellationToken token);
    Task<TreatmentPlan?> FindPlanAsync(Guid id, bool tracking, CancellationToken token);
    Task<TreatmentPlanDetails?> GetPlanAsync(Guid id, Guid? visibleDoctorId, CancellationToken token);
    Task<PagedResult<TreatmentPlanListItem>> SearchPlansAsync(TreatmentPlanSearch query, Guid? visibleDoctorId, CancellationToken token);
    Task<PlanExecutionSource?> FindPlanExecutionSourceAsync(Guid planItemId, CancellationToken token);
    Task<Treatment?> FindTreatmentAsync(Guid id, bool tracking, CancellationToken token);
    Task<TreatmentDetails?> GetTreatmentAsync(Guid id, Guid? visibleDoctorId, CancellationToken token);
    Task<PagedResult<TreatmentListItem>> SearchTreatmentsAsync(TreatmentSearch query, Guid? visibleDoctorId, CancellationToken token);
    void AddCatalog(TreatmentCatalogItem item);
    void AddPlan(TreatmentPlan plan);
    void AddTreatment(Treatment treatment);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken token);
}

public interface ITreatmentCatalogService
{
    Task<IReadOnlyCollection<CatalogItemDetails>> ListAsync(bool includeInactive, CancellationToken token);
    Task<Guid> CreateAsync(CatalogItemInput input, CancellationToken token);
    Task<bool> UpdateAsync(Guid id, CatalogItemInput input, CancellationToken token);
}
public interface ITreatmentPlanService
{
    Task<PagedResult<TreatmentPlanListItem>> SearchAsync(TreatmentPlanSearch query, CancellationToken token);
    Task<TreatmentPlanDetails?> GetAsync(Guid id, CancellationToken token);
    Task<Guid> CreateAsync(CreateTreatmentPlanCommand command, CancellationToken token);
    Task<bool> UpdateAsync(UpdateTreatmentPlanCommand command, CancellationToken token);
    Task<bool> AddItemAsync(Guid planId, PlanItemInput input, Guid version, CancellationToken token);
    Task<bool> UpdateItemAsync(UpdatePlanItemCommand command, CancellationToken token);
    Task<bool> RemoveItemAsync(Guid planId, Guid itemId, Guid version, CancellationToken token);
    Task<bool> TransitionAsync(Guid id, string action, Guid version, CancellationToken token);
}
public interface ITreatmentService
{
    Task<PagedResult<TreatmentListItem>> SearchAsync(TreatmentSearch query, CancellationToken token);
    Task<TreatmentDetails?> GetAsync(Guid id, CancellationToken token);
    Task<Guid> CreateAsync(CreateTreatmentCommand command, CancellationToken token);
    Task<bool> UpdateNotesAsync(Guid id, string? notes, Guid version, CancellationToken token);
    Task<bool> TransitionAsync(Guid id, string action, Guid version, CancellationToken token);
}
