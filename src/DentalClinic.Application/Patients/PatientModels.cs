using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.Patients;

public enum PatientSortField
{
    CreatedAt = 1,
    Name = 2,
    PatientNumber = 3
}

public sealed record PatientSearchQuery(
    string? Search = null,
    PatientStatus? Status = null,
    PatientGender? Gender = null,
    DateOnly? RegisteredFrom = null,
    DateOnly? RegisteredTo = null,
    PatientSortField SortBy = PatientSortField.CreatedAt,
    bool Descending = true,
    int Page = 1,
    int PageSize = 20);

public sealed record PatientListItem(
    Guid Id,
    string PatientNumber,
    string FullName,
    PatientGender Gender,
    string Phone,
    string? Email,
    PatientStatus Status,
    DateTimeOffset CreatedAt);

public sealed record MedicalTextItem(
    Guid Id, string Name, string? Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record MedicationItem(
    Guid Id, string Name, string? Dosage, string? Notes, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record SurgeryItem(
    Guid Id, string Procedure, DateOnly? ProcedureDate, string? Notes,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record PatientDetails(
    Guid Id,
    string PatientNumber,
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
    string? Notes,
    string? MedicalNotes,
    PatientStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    bool CanViewMedicalInformation,
    bool CanEditMedicalInformation,
    IReadOnlyCollection<MedicalTextItem> Allergies,
    IReadOnlyCollection<MedicalTextItem> MedicalConditions,
    IReadOnlyCollection<MedicationItem> Medications,
    IReadOnlyCollection<SurgeryItem> Surgeries);
