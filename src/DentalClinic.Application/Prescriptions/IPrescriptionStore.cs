using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Platform;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Prescriptions;

public interface IPrescriptionTransaction : IAsyncDisposable { Task CommitAsync(CancellationToken token); }
public interface IPrescriptionStore
{
    Task<IPrescriptionTransaction> BeginTransactionAsync(CancellationToken token);
    Task<string> ReserveNumberAsync(Guid tenantId, CancellationToken token);
    Task<PrescriptionPatient?> FindPatientAsync(Guid id, CancellationToken token);
    Task<PrescriptionDoctor?> FindDoctorAsync(Guid id, CancellationToken token);
    Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken token);
    Task<PrescriptionAssociation?> FindAppointmentAsync(Guid id, CancellationToken token);
    Task<PrescriptionAssociation?> FindExaminationAsync(Guid id, CancellationToken token);
    Task<PrescriptionAssociation?> FindTreatmentAsync(Guid id, CancellationToken token);
    Task<MedicationCatalogItem?> FindMedicationAsync(Guid id, bool tracking, CancellationToken token);
    Task<PagedResult<MedicationCatalogDetails>> SearchMedicationsAsync(MedicationSearch search, CancellationToken token);
    Task<Prescription?> FindPrescriptionAsync(Guid id, bool tracking, CancellationToken token);
    Task<PrescriptionDetails?> GetPrescriptionAsync(Guid id, Guid? visibleDoctorId, CancellationToken token);
    Task<PagedResult<PrescriptionListItem>> SearchPrescriptionsAsync(PrescriptionSearch search, Guid? visibleDoctorId, CancellationToken token);
    Task<PrescriptionClinic> GetClinicAsync(CancellationToken token);
    void AddMedication(MedicationCatalogItem item);
    void AddPrescription(Prescription prescription);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken token);
}

public interface IMedicationCatalogService
{
    Task<PagedResult<MedicationCatalogDetails>> SearchAsync(MedicationSearch search, CancellationToken token);
    Task<Guid> CreateAsync(MedicationCatalogInput input, CancellationToken token);
    Task<bool> UpdateAsync(Guid id, MedicationCatalogInput input, CancellationToken token);
}
public interface IPrescriptionService
{
    Task<PagedResult<PrescriptionListItem>> SearchAsync(PrescriptionSearch search, CancellationToken token);
    Task<PrescriptionDetails?> GetAsync(Guid id, CancellationToken token);
    Task<Guid> CreateAsync(CreatePrescriptionCommand command, CancellationToken token);
    Task<bool> UpdateAsync(UpdatePrescriptionCommand command, CancellationToken token);
    Task<bool> AddItemAsync(Guid id, PrescriptionItemInput input, Guid version, CancellationToken token);
    Task<bool> UpdateItemAsync(UpdatePrescriptionItemCommand command, CancellationToken token);
    Task<bool> RemoveItemAsync(Guid id, Guid itemId, Guid version, CancellationToken token);
    Task<bool> IssueAsync(Guid id, Guid version, CancellationToken token);
    Task<bool> CancelAsync(Guid id, Guid version, CancellationToken token);
    Task<PrescriptionDocument?> DownloadAsync(Guid id, bool print, CancellationToken token);
    Task<string?> GetQrSvgAsync(Guid id, CancellationToken token);
}
public interface IPrescriptionDocumentService { Task<PrescriptionDocument> GenerateAsync(PrescriptionDocumentModel model, CancellationToken token); }
public interface IPrescriptionQrCodeService { string GenerateSvg(string payload); }
public interface IPrescriptionReferenceGenerator { string Generate(); }
public interface ISpeechToTextService { Task<string> TranscribeAsync(Stream audio, string? language, CancellationToken token); }
