using System.Net.Mail;
using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Patients;

internal static class PatientValidation
{
    public static void Profile(PatientProfileInput profile, DateTimeOffset now)
    {
        var errors = new List<ValidationFailure>();
        Required(profile.FirstName, "FirstName", 100, errors);
        Optional(profile.MiddleName, "MiddleName", 100, errors);
        Required(profile.LastName, "LastName", 100, errors);
        Required(profile.Phone, "Phone", 50, errors);
        Optional(profile.AlternatePhone, "AlternatePhone", 50, errors);
        Optional(profile.Address, "Address", 500, errors);
        Optional(profile.City, "City", 100, errors);
        Optional(profile.Country, "Country", 100, errors);
        Optional(profile.EmergencyContactName, "EmergencyContactName", 200, errors);
        Optional(profile.EmergencyContactPhone, "EmergencyContactPhone", 50, errors);
        Optional(profile.Nationality, "Nationality", 100, errors);
        Optional(profile.Occupation, "Occupation", 150, errors);
        Optional(profile.Notes, "Notes", 2000, errors);
        if (!Enum.IsDefined(profile.Gender))
        {
            errors.Add(new("Gender", "Gender is invalid."));
        }
        if (profile.DateOfBirth > DateOnly.FromDateTime(now.UtcDateTime))
            errors.Add(new("DateOfBirth", "Date of birth cannot be in the future."));
        if (profile.Email is { Length: > 0 } && (!MailAddress.TryCreate(profile.Email, out _) || profile.Email.Length > 256))
            errors.Add(new("Email", "Email must be a valid address of at most 256 characters."));
        if (profile.MaritalStatus.HasValue && !Enum.IsDefined(profile.MaritalStatus.Value))
            errors.Add(new("MaritalStatus", "Marital status is invalid."));
        Throw(errors);
    }

    public static void MedicalText(MedicalTextCommand command)
    {
        var errors = new List<ValidationFailure>();
        Required(command.Name, "Name", 200, errors); Optional(command.Notes, "Notes", 1000, errors); Throw(errors);
    }

    public static void Medication(MedicationCommand command)
    {
        var errors = new List<ValidationFailure>();
        Required(command.Name, "Name", 200, errors); Optional(command.Dosage, "Dosage", 200, errors);
        Optional(command.Notes, "Notes", 1000, errors); Throw(errors);
    }

    public static void Surgery(SurgeryCommand command)
    {
        var errors = new List<ValidationFailure>();
        Required(command.Procedure, "Procedure", 300, errors); Optional(command.Notes, "Notes", 1000, errors); Throw(errors);
    }

    public static ValidationException Error(string property, string message) =>
        new([new ValidationFailure(property, message)]);

    private static void Required(string? value, string property, int max, List<ValidationFailure> errors)
    {
        if (string.IsNullOrWhiteSpace(value)) errors.Add(new(property, $"{property} is required."));
        else if (value.Trim().Length > max) errors.Add(new(property, $"{property} cannot exceed {max} characters."));
    }
    private static void Optional(string? value, string property, int max, List<ValidationFailure> errors)
    { if (value?.Trim().Length > max) errors.Add(new(property, $"{property} cannot exceed {max} characters.")); }
    private static void Throw(List<ValidationFailure> errors)
    { if (errors.Count > 0) throw new ValidationException(errors); }
}
