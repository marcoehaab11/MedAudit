using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Patients;

public sealed class PatientNumberSequence : TenantOwnedEntity
{
    private PatientNumberSequence() { }
    public string Prefix { get; private set; } = string.Empty;
    public long LastValue { get; private set; }
}
