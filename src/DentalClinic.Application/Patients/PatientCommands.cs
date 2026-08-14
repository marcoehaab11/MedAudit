using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.Patients;

public sealed record PatientProfileInput(
    string FirstName,
    string? MiddleName,
    string LastName,
    PatientGender Gender,
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
    MaritalStatus? MaritalStatus,
    string? Notes);

public sealed record CreatePatientCommand(PatientProfileInput Profile);
public sealed record UpdatePatientCommand(Guid PatientId, PatientProfileInput Profile);
public sealed record MedicalTextCommand(string Name, string? Notes);
public sealed record MedicationCommand(string Name, string? Dosage, string? Notes);
public sealed record SurgeryCommand(string Procedure, DateOnly? ProcedureDate, string? Notes);
public sealed record UpdateMedicalNotesCommand(Guid PatientId, string? MedicalNotes);
