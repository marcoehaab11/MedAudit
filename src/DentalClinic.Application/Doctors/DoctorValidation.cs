using FluentValidation;
using FluentValidation.Results;

namespace DentalClinic.Application.Doctors;

internal static class DoctorValidation
{
    public static void Profile(DoctorProfileInput input)
    {
        var errors = new List<ValidationFailure>();
        Required(input.Specialization, nameof(input.Specialization), 150, errors);
        Required(input.LicenseNumber, nameof(input.LicenseNumber), 100, errors);
        Optional(input.Bio, nameof(input.Bio), 2000, errors);
        if (input.ConsultationDurationMinutes is < 5 or > 480)
            errors.Add(new(nameof(input.ConsultationDurationMinutes), "Consultation duration must be between 5 and 480 minutes."));
        Throw(errors);
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
    private static void Throw(List<ValidationFailure> errors) { if (errors.Count > 0) throw new ValidationException(errors); }
}
