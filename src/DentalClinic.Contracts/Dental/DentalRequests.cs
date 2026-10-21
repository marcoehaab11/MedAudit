namespace DentalClinic.Contracts.Dental;

public sealed record UpdateExaminationNotesRequest(string? Notes, Guid Version);
public sealed record DentalRecordRequest(int ToothNumber, int Type, IReadOnlyCollection<int> Surfaces,
    string? Notes, Guid Version, int? CariesClass = null);
public sealed record EndodonticCanalRequest(string Name, decimal? LengthMm, string? Notes, string? FinalFileSize = null);
public sealed record EndodonticRecordRequest(int ToothNumber, string? Notes,
    IReadOnlyCollection<EndodonticCanalRequest> Canals, Guid Version, int? Stage = null, Guid? TreatmentId = null, string? RestorationType = null, string? PostType = null, string? PostCanal = null, string? WorkflowJson = null);
public sealed record ClinicalRecordVersionRequest(Guid Version);
