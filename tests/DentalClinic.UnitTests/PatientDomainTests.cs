using DentalClinic.Domain.Patients;

namespace DentalClinic.UnitTests;

public sealed class PatientDomainTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PatientNormalizesProfileAndStartsActive()
    {
        var patient = CreatePatient();

        Assert.Equal("CLN-000001", patient.PatientNumber);
        Assert.Equal("Mona", patient.FirstName);
        Assert.Equal("Hassan", patient.LastName);
        Assert.Equal(PatientStatus.Active, patient.Status);
        Assert.Equal(TenantId, patient.TenantId);
        Assert.Equal(Now, patient.CreatedAt);
    }

    [Fact]
    public void FutureBirthDateAndInvalidNumberAreRejected()
    {
        Assert.Throws<ArgumentException>(() => CreatePatient("not-a-number"));
        Assert.Throws<ArgumentException>(() => new Patient(
            TenantId, "CLN-000002", "Mona", null, "Hassan", PatientGender.Female,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)), "+20 100", null, null,
            null, null, null, null, null, null, null, null, null, null, Now));
    }

    [Fact]
    public void ArchiveIsIdempotentAndUpdatesTimestamp()
    {
        var patient = CreatePatient();
        var archivedAt = Now.AddMinutes(10);

        patient.Archive(archivedAt);
        patient.Archive(archivedAt.AddMinutes(1));

        Assert.Equal(PatientStatus.Archived, patient.Status);
        Assert.Equal(archivedAt, patient.UpdatedAt);
    }

    [Fact]
    public void MedicalRecordsRemainTenantOwned()
    {
        var patient = CreatePatient();
        var allergy = new PatientAllergy(TenantId, patient.Id, "Penicillin", "Severe", Now);

        allergy.Update("Penicillin", "Confirmed", Now.AddMinutes(1));

        Assert.Equal(TenantId, allergy.TenantId);
        Assert.Equal(patient.Id, allergy.PatientId);
        Assert.Equal("Confirmed", allergy.Notes);
    }

    private static Patient CreatePatient(string number = "CLN-000001") => new(
        TenantId, number, " Mona ", null, " Hassan ", PatientGender.Female,
        new DateOnly(1990, 4, 2), "+20 100", null, "mona@example.com", null, "Cairo", "Egypt",
        null, null, "Egyptian", "Teacher", MaritalStatus.Married, null, null, Now);
}
