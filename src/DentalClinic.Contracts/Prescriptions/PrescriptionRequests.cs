namespace DentalClinic.Contracts.Prescriptions;

public sealed record MedicationCatalogRequest(string Name, string? GenericName, string? Strength, int? Form, string? Notes, bool IsActive = true);
public sealed record PrescriptionItemRequest(Guid? MedicationId, string? MedicationName, string? GenericName, string? Strength, int? Form,
    string Dose, string Frequency, string Duration, string? Route, string Instructions, int? Quantity, int SortOrder);
public sealed record CreatePrescriptionRequest(Guid PatientId, Guid DoctorProfileId, Guid? AppointmentId, Guid? ExaminationId,
    Guid? TreatmentId, string? Notes, IReadOnlyCollection<PrescriptionItemRequest> Items);
public sealed record UpdatePrescriptionRequest(Guid PatientId, Guid DoctorProfileId, Guid? AppointmentId, Guid? ExaminationId,
    Guid? TreatmentId, string? Notes, Guid Version);
public sealed record UpdatePrescriptionItemRequest(string Dose, string Frequency, string Duration, string? Route, string Instructions,
    int? Quantity, int SortOrder, Guid Version);
public sealed record PrescriptionVersionRequest(Guid Version);
