using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Dental;

namespace DentalClinic.Application.Dental;

public sealed record DentalRecordInput<TType>(int ToothNumber, TType Type,
    IReadOnlyCollection<ToothSurface> Surfaces, string? Notes) where TType : struct, Enum;
public sealed record EndodonticInput(int ToothNumber, string? Notes, IReadOnlyCollection<EndodonticCanalInput> Canals);

public sealed record DentalFindingDetails(Guid Id, Guid ToothId, int ToothNumber, DentalFindingType Type,
    IReadOnlyCollection<ToothSurface> Surfaces, string? Notes, DateTimeOffset CreatedAt, Guid CreatedBy);
public sealed record DentalProcedureDetails(Guid Id, Guid ToothId, int ToothNumber, DentalProcedureType Type,
    IReadOnlyCollection<ToothSurface> Surfaces, string? Notes, DateTimeOffset CreatedAt, Guid CreatedBy);
public sealed record EndodonticCanalDetails(Guid Id, string Name, decimal LengthMm, string? Notes);
public sealed record EndodonticDetails(Guid Id, Guid ToothId, int ToothNumber, string? Notes,
    IReadOnlyCollection<EndodonticCanalDetails> Canals, DateTimeOffset CreatedAt, Guid CreatedBy);

public sealed record ExaminationDetails(Guid Id, Guid PatientId, string PatientName, string PatientNumber,
    Guid AppointmentId, AppointmentStatus AppointmentStatus, Guid DoctorUserId, string DoctorName,
    ExaminationStatus Status, string? Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateTimeOffset? CompletedAt, Guid Version, bool CanEdit, bool CanComplete,
    IReadOnlyCollection<DentalFindingDetails> Findings,
    IReadOnlyCollection<DentalProcedureDetails> Procedures,
    IReadOnlyCollection<EndodonticDetails> EndodonticRecords);

public sealed record ToothChartSummary(Guid ToothId, int ToothNumber,
    IReadOnlyCollection<DentalFindingType> Findings, IReadOnlyCollection<DentalProcedureType> Procedures,
    bool HasEndodonticRecord, DateTimeOffset? LastRecordedAt);
public sealed record ExaminationHistoryItem(Guid Id, Guid AppointmentId, ExaminationStatus Status,
    string DoctorName, DateTimeOffset CreatedAt, DateTimeOffset? CompletedAt);
public sealed record PatientDentalChart(Guid PatientId, string PatientName, string PatientNumber,
    IReadOnlyCollection<ToothChartSummary> Teeth, IReadOnlyCollection<ExaminationHistoryItem> RecentExaminations);

public sealed record ClinicalAppointment(Guid Id, Guid PatientId, Guid DoctorProfileId,
    Guid DoctorUserId, AppointmentStatus Status);
public sealed record DentalPatient(Guid Id, string Name, string PatientNumber, bool IsActive);

public sealed class DentalNotFoundException(string message) : Exception(message);
