using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Dental;

public interface IDentalStore
{
    Task<DentalPatient?> FindPatientAsync(Guid patientId, CancellationToken cancellationToken);
    Task<ClinicalAppointment?> FindAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<Guid?> FindDoctorProfileIdForUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<bool> ExaminationExistsForAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<Examination?> FindExaminationAsync(Guid id, bool tracking, CancellationToken cancellationToken);
    Task<ExaminationDetails?> GetExaminationAsync(Guid id, CancellationToken cancellationToken);
    Task<Guid?> FindExaminationIdByAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<PatientDentalChart?> GetChartAsync(Guid patientId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ExaminationHistoryItem>> GetHistoryAsync(Guid patientId, int take,
        CancellationToken cancellationToken);
    void Add(Examination examination);
    void AddAudit(PlatformAuditLog audit);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public interface IDentalQueries
{
    Task<PatientDentalChart?> GetChartAsync(Guid patientId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ExaminationHistoryItem>> GetHistoryAsync(Guid patientId, int take,
        CancellationToken cancellationToken);
    Task<ExaminationDetails?> GetExaminationAsync(Guid id, CancellationToken cancellationToken);
    Task<ExaminationDetails?> GetByAppointmentAsync(Guid appointmentId, CancellationToken cancellationToken);
}

public interface IExaminationCommands
{
    Task<Guid> CreateAsync(Guid appointmentId, CancellationToken cancellationToken);
    Task<bool> UpdateNotesAsync(Guid id, string? notes, Guid version, CancellationToken cancellationToken);
    Task<bool> AddFindingAsync(Guid id, DentalRecordInput<DentalFindingType> input, Guid version, CancellationToken cancellationToken);
    Task<bool> UpdateFindingAsync(Guid id, Guid findingId, DentalRecordInput<DentalFindingType> input, Guid version, CancellationToken cancellationToken);
    Task<bool> RemoveFindingAsync(Guid id, Guid findingId, Guid version, CancellationToken cancellationToken);
    Task<bool> AddProcedureAsync(Guid id, DentalRecordInput<DentalProcedureType> input, Guid version, CancellationToken cancellationToken);
    Task<bool> UpdateProcedureAsync(Guid id, Guid procedureId, DentalRecordInput<DentalProcedureType> input, Guid version, CancellationToken cancellationToken);
    Task<bool> RemoveProcedureAsync(Guid id, Guid procedureId, Guid version, CancellationToken cancellationToken);
    Task<bool> AddEndodonticAsync(Guid id, EndodonticInput input, Guid version, CancellationToken cancellationToken);
    Task<bool> UpdateEndodonticAsync(Guid id, Guid recordId, EndodonticInput input, Guid version, CancellationToken cancellationToken);
    Task<bool> RemoveEndodonticAsync(Guid id, Guid recordId, Guid version, CancellationToken cancellationToken);
    Task<bool> CompleteAsync(Guid id, Guid version, CancellationToken cancellationToken);
}
