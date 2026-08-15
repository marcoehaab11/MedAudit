namespace DentalClinic.Domain.Pharmacy;

public enum DispensingStatus
{
    PartiallyDispensed = 1,
    FullyDispensed = 2,
    Reversed = 3
}

public sealed class PharmacyDispensingException(string message) : Exception(message);
public sealed class PharmacyConcurrencyException(string message) : Exception(message);
