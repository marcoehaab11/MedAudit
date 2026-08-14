using System.Diagnostics.CodeAnalysis;

namespace DentalClinic.Domain.Patients;

public enum MaritalStatus
{
    NotSpecified = 0,
    [SuppressMessage("Naming", "CA1720:Identifier contains type name", Justification = "Single is the standard marital-status term.")]
    Single = 1,
    Married = 2,
    Divorced = 3,
    Widowed = 4
}
