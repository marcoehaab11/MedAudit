using DentalClinic.Domain.Treatments;

namespace DentalClinic.UnitTests;

public sealed class TreatmentDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PlanCalculatesItemAndPlanDiscountsWithoutChangingCatalogPrice()
    {
        var plan = CreatePlan();
        plan.AddItem(Guid.NewGuid(), TreatmentType.Crown, "Ceramic crown", 11, 2, 500m, 50m, null, plan.Version, Now);
        plan.Update("Restoration", null, 100m, plan.Version, Now.AddMinutes(1));
        Assert.Equal(950m, plan.Subtotal); Assert.Equal(100m, plan.DiscountAmount); Assert.Equal(850m, plan.Total);
        Assert.Equal(500m, plan.Items.Single().UnitPrice);
    }

    [Fact]
    public void CatalogPriceIsSnapshottedByPlanItem()
    {
        var catalog = new TreatmentCatalogItem(Tenant, TreatmentType.Filling, "Composite", "fill", null, 200m, Now);
        var plan = CreatePlan(); plan.AddItem(catalog.Id, catalog.Type, catalog.Name, 36, 1, catalog.DefaultPrice, 0, null, plan.Version, Now);
        catalog.Update(catalog.Type, catalog.Name, catalog.Code, null, 300m, true, Now.AddDays(1));
        Assert.Equal(200m, plan.Items.Single().UnitPrice); Assert.Equal(200m, plan.Total);
    }

    [Fact]
    public void AcceptedPlanCannotBeEdited()
    {
        var plan = CreatePlan(); plan.AddItem(Guid.NewGuid(), TreatmentType.Implant, "Implant", 14, 1, 1000m, 0, null, plan.Version, Now);
        plan.Propose(plan.Version, Now); plan.Accept(plan.Version, Now);
        Assert.Throws<TreatmentStateException>(() => plan.Update("Changed", null, 0, plan.Version, Now));
        Assert.Throws<TreatmentStateException>(() => plan.RemoveItem(plan.Items.Single().Id, plan.Version, Now));
    }

    [Fact]
    public void PlanWorkflowRejectsInvalidTransitionsAndStaleVersions()
    {
        var plan = CreatePlan(); var stale = plan.Version;
        Assert.Throws<TreatmentStateException>(() => plan.Accept(plan.Version, Now));
        plan.AddItem(Guid.NewGuid(), TreatmentType.Extraction, "Extraction", 48, 1, 100m, 0, null, plan.Version, Now);
        Assert.Throws<TreatmentConcurrencyException>(() => plan.Propose(stale, Now));
        plan.Propose(plan.Version, Now); plan.Accept(plan.Version, Now); plan.Start(plan.Version, Now); plan.Complete(plan.Version, Now);
        Assert.Equal(TreatmentPlanStatus.Completed, plan.Status);
    }

    [Fact]
    public void TreatmentNormalizesTeethAndCompletedExecutionIsImmutable()
    {
        var treatment = new Treatment(Tenant, Guid.NewGuid(), Guid.NewGuid(), null, null, null, Guid.NewGuid(), null,
            TreatmentType.RootCanal, "Root canal", [36, 36, 37], 750m, null, Now);
        Assert.Equal([36, 37], treatment.Teeth.OrderBy(x => x.ToothNumber).Select(x => x.ToothNumber));
        treatment.Start(treatment.Version, Now); treatment.Complete(treatment.Version, Now.AddHours(1));
        Assert.Throws<TreatmentStateException>(() => treatment.UpdateNotes("rewrite", treatment.Version, Now.AddHours(2)));
        Assert.Throws<TreatmentStateException>(() => treatment.Cancel(treatment.Version, Now.AddHours(2)));
    }

    [Fact]
    public void InvalidMoneyToothAndDiscountAreRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new TreatmentCatalogItem(Tenant, TreatmentType.Filling, "Filling", "F", null, 10.001m, Now));
        var plan = CreatePlan();
        Assert.Throws<ArgumentOutOfRangeException>(() => plan.AddItem(Guid.NewGuid(), TreatmentType.Filling, "Filling", 19, 1, 10m, 0, null, plan.Version, Now));
        Assert.Throws<ArgumentOutOfRangeException>(() => plan.AddItem(Guid.NewGuid(), TreatmentType.Filling, "Filling", 11, 1, 10m, 11m, null, plan.Version, Now));
    }

    private static TreatmentPlan CreatePlan() => new(Tenant, Guid.NewGuid(), Guid.NewGuid(), "Restoration", null, 0, Now);
}
