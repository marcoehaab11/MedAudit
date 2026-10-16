namespace DentalClinic.Contracts.Patients;

public sealed record PatientProfileRequest(
    string FirstName,
    string? MiddleName,
    string LastName,
    int Gender,
    DateOnly DateOfBirth,
    string Phone,
    string? AlternatePhone,
    string? Email,
    string? Address,
    string? City,
    string? Country,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? Nationality,
    string? Occupation,
    int? MaritalStatus,
    string? Notes, IReadOnlyCollection<string>? Allergies = null, IReadOnlyCollection<string>? MedicalConditions = null, IReadOnlyCollection<string>? Medications = null);

public sealed record MedicalTextRequest(string Name, string? Notes);
public sealed record MedicationRequest(string Name, string? Dosage, string? Notes);
public sealed record SurgeryRequest(string Procedure, DateOnly? ProcedureDate, string? Notes);
public sealed record MedicalNotesRequest(string? MedicalNotes);
