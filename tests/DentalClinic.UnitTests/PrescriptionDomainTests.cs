using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.UnitTests;

public sealed class PrescriptionDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void DraftSupportsValidatedMedicationItemsAndOrdering()
    {
        var prescription = Create();
        prescription.AddItem(null, "Amoxicillin", "Amoxicillin", "500 mg", MedicationForm.Capsule, "500 mg", "Every 8 hours", "5 days", "Oral", "After meals", 15, 2, prescription.Version, Now);
        prescription.AddItem(null, "Mouthwash", null, null, MedicationForm.Mouthwash, "10 ml", "Twice daily", "7 days", null, "Do not swallow", 1, 1, prescription.Version, Now);
        Assert.Equal([1, 2], prescription.Items.OrderBy(x => x.SortOrder).Select(x => x.SortOrder));
    }

    [Fact]
    public void IssueRequiresAtLeastOneMedication()
    {
        var prescription = Create();
        Assert.Throws<PrescriptionStateException>(() => prescription.Issue(Actor, "opaque-reference", prescription.Version, Now));
    }

    [Fact]
    public void IssuedPrescriptionAndItemsAreImmutable()
    {
        var prescription = CreateWithItem(); prescription.Issue(Actor, "opaque-reference", prescription.Version, Now);
        Assert.Equal(PrescriptionStatus.Issued, prescription.Status);
        Assert.Throws<PrescriptionStateException>(() => prescription.Update("rewrite", prescription.Version, Now));
        Assert.Throws<PrescriptionStateException>(() => prescription.RemoveItem(prescription.Items.Single().Id, prescription.Version, Now));
    }

    [Fact]
    public void MedicationSnapshotDoesNotDependOnCatalogMutation()
    {
        var catalog = new MedicationCatalogItem(Tenant, "Amoxicillin", "Amoxicillin", "500 mg", MedicationForm.Capsule, null, Now);
        var prescription = Create(); prescription.AddItem(catalog.Id, catalog.Name, catalog.GenericName, catalog.Strength, catalog.Form, "500 mg", "Every 8 hours", "5 days", "Oral", "After meals", 15, 1, prescription.Version, Now);
        catalog.Update("Changed", null, "1 g", MedicationForm.Tablet, null, false, Now.AddDays(1));
        var item = prescription.Items.Single(); Assert.Equal("Amoxicillin", item.MedicationNameSnapshot); Assert.Equal("500 mg", item.StrengthSnapshot);
    }

    [Fact]
    public void StaleVersionsAndInvalidDosageAreRejected()
    {
        var prescription = Create(); var stale = prescription.Version;
        prescription.Update("draft", prescription.Version, Now);
        Assert.Throws<PrescriptionConcurrencyException>(() => prescription.AddItem(null, "Drug", null, null, null, "1", "Daily", "1 day", null, "Use", null, 1, stale, Now));
        Assert.Throws<ArgumentException>(() => prescription.AddItem(null, "Drug", null, null, null, "", "Daily", "1 day", null, "Use", null, 1, prescription.Version, Now));
    }

    [Fact]
    public void CancelIsTerminalAndIssuedCanBeCancelled()
    {
        var prescription = CreateWithItem(); prescription.Issue(Actor, "opaque-reference", prescription.Version, Now); prescription.Cancel(prescription.Version, Now.AddMinutes(1));
        Assert.Equal(PrescriptionStatus.Cancelled, prescription.Status);
        Assert.Throws<PrescriptionStateException>(() => prescription.Cancel(prescription.Version, Now));
    }

    private static Prescription Create() => new(Tenant, Guid.NewGuid(), Guid.NewGuid(), null, null, null, "RX-000001", null, Actor, Now);
    private static Prescription CreateWithItem() { var x = Create(); x.AddItem(null, "Drug", null, null, null, "1 tablet", "Daily", "3 days", "Oral", "After food", 3, 1, x.Version, Now); return x; }
}
