namespace DentalClinic.Contracts.Dental;

public sealed record UpdateExaminationNotesRequest(string? Notes, Guid Version);
public sealed record DentalRecordRequest(int ToothNumber, int Type, IReadOnlyCollection<int> Surfaces,
    string? Notes, Guid Version);
public sealed record EndodonticCanalRequest(string Name, decimal LengthMm, string? Notes);
public sealed record EndodonticRecordRequest(int ToothNumber, string? Notes,
    IReadOnlyCollection<EndodonticCanalRequest> Canals, Guid Version);
public sealed record ClinicalRecordVersionRequest(Guid Version);
