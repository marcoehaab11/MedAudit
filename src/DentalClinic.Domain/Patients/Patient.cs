using System.Text.RegularExpressions;
using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed partial class Patient : TenantOwnedEntity
{
    private Patient() { }

    public Patient(
        Guid tenantId,
        string patientNumber,
        string firstName,
        string? middleName,
        string lastName,
        PatientGender gender,
        DateOnly dateOfBirth,
        string phone,
        string? alternatePhone,
        string? email,
        string? address,
        string? city,
        string? country,
        string? emergencyContactName,
        string? emergencyContactPhone,
        string? nationality,
        string? occupation,
        MaritalStatus? maritalStatus,
        string? notes,
        string? medicalNotes,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
        TenantId = tenantId;
        PatientNumber = NormalizePatientNumber(patientNumber);
        ApplyProfile(firstName, middleName, lastName, gender, dateOfBirth, phone, alternatePhone,
            email, address, city, country, emergencyContactName, emergencyContactPhone,
            nationality, occupation, maritalStatus, notes, medicalNotes, createdAt);
        Status = PatientStatus.Active;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string PatientNumber { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string? MiddleName { get; private set; }
    public string LastName { get; private set; } = string.Empty;
    public PatientGender Gender { get; private set; }
    public DateOnly DateOfBirth { get; private set; }
    public string Phone { get; private set; } = string.Empty;
    public string? AlternatePhone { get; private set; }
    public string? Email { get; private set; }
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? Country { get; private set; }
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }
    public string? Nationality { get; private set; }
    public string? Occupation { get; private set; }
    public MaritalStatus? MaritalStatus { get; private set; }
    public string? Notes { get; private set; }
    public string? MedicalNotes { get; private set; }
    public PatientStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(
        string firstName,
        string? middleName,
        string lastName,
        PatientGender gender,
        DateOnly dateOfBirth,
        string phone,
        string? alternatePhone,
        string? email,
        string? address,
        string? city,
        string? country,
        string? emergencyContactName,
        string? emergencyContactPhone,
        string? nationality,
        string? occupation,
        MaritalStatus? maritalStatus,
        string? notes,
        string? medicalNotes,
        DateTimeOffset updatedAt)
    {
        ApplyProfile(firstName, middleName, lastName, gender, dateOfBirth, phone, alternatePhone,
            email, address, city, country, emergencyContactName, emergencyContactPhone,
            nationality, occupation, maritalStatus, notes, medicalNotes, updatedAt);
        UpdatedAt = updatedAt;
    }

    public void Archive(DateTimeOffset archivedAt)
    {
        if (Status == PatientStatus.Archived) return;
        Status = PatientStatus.Archived;
        UpdatedAt = archivedAt;
    }

    public void UpdateMedicalNotes(string? medicalNotes, DateTimeOffset updatedAt)
    {
        MedicalNotes = PatientField.Optional(medicalNotes, nameof(medicalNotes), 4000);
        UpdatedAt = updatedAt;
    }

    private void ApplyProfile(
        string firstName, string? middleName, string lastName, PatientGender gender,
        DateOnly dateOfBirth, string phone, string? alternatePhone, string? email,
        string? address, string? city, string? country, string? emergencyContactName,
        string? emergencyContactPhone, string? nationality, string? occupation,
        MaritalStatus? maritalStatus, string? notes, string? medicalNotes,
        DateTimeOffset now)
    {
        if (!Enum.IsDefined(gender)) throw new ArgumentOutOfRangeException(nameof(gender));
        if (dateOfBirth > DateOnly.FromDateTime(now.UtcDateTime))
            throw new ArgumentException("Date of birth cannot be in the future.", nameof(dateOfBirth));
        if (maritalStatus.HasValue && !Enum.IsDefined(maritalStatus.Value))
            throw new ArgumentOutOfRangeException(nameof(maritalStatus));

        FirstName = PatientField.Required(firstName, nameof(firstName), 100);
        MiddleName = PatientField.Optional(middleName, nameof(middleName), 100);
        LastName = PatientField.Required(lastName, nameof(lastName), 100);
        Gender = gender;
        DateOfBirth = dateOfBirth;
        Phone = PatientField.Required(phone, nameof(phone), 50);
        AlternatePhone = PatientField.Optional(alternatePhone, nameof(alternatePhone), 50);
        Email = PatientField.Optional(email, nameof(email), 256)?.ToLowerInvariant();
        Address = PatientField.Optional(address, nameof(address), 500);
        City = PatientField.Optional(city, nameof(city), 100);
        Country = PatientField.Optional(country, nameof(country), 100);
        EmergencyContactName = PatientField.Optional(emergencyContactName, nameof(emergencyContactName), 200);
        EmergencyContactPhone = PatientField.Optional(emergencyContactPhone, nameof(emergencyContactPhone), 50);
        Nationality = PatientField.Optional(nationality, nameof(nationality), 100);
        Occupation = PatientField.Optional(occupation, nameof(occupation), 150);
        MaritalStatus = maritalStatus is null or global::DentalClinic.Domain.Patients.MaritalStatus.NotSpecified
            ? null
            : maritalStatus;
        Notes = PatientField.Optional(notes, nameof(notes), 2000);
        MedicalNotes = PatientField.Optional(medicalNotes, nameof(medicalNotes), 4000);
    }

    private static string NormalizePatientNumber(string value)
    {
        var normalized = PatientField.Required(value, nameof(value), 20).ToUpperInvariant();
        return PatientNumberPattern().IsMatch(normalized)
            ? normalized
            : throw new ArgumentException("Patient number format is invalid.", nameof(value));
    }

    [GeneratedRegex("^[A-Z0-9]{1,10}-[0-9]{6}$", RegexOptions.CultureInvariant)]
    private static partial Regex PatientNumberPattern();
}

internal static class PatientField
{
    public static string Required(string value, string parameterName, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameterName);
        var normalized = value.Trim();
        return normalized.Length <= maximumLength
            ? normalized
            : throw new ArgumentException($"Value cannot exceed {maximumLength} characters.", parameterName);
    }

    public static string? Optional(string? value, string parameterName, int maximumLength) =>
        string.IsNullOrWhiteSpace(value) ? null : Required(value, parameterName, maximumLength);
}
