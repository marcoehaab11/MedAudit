using DentalClinic.Domain.Pharmacy;
using Xunit;

namespace DentalClinic.UnitTests;

public sealed class PharmacyDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PharmacyDispensingCreationValidatesRequiredFields()
    {
        var tenantId = Guid.NewGuid();
        var rxId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var dispensing = new PharmacyDispensing(
            tenantId,
            rxId,
            patientId,
            "DISP-000001",
            userId,
            DispensingStatus.PartiallyDispensed,
            "Test Notes",
            Now
        );

        Assert.Equal(tenantId, dispensing.TenantId);
        Assert.Equal(rxId, dispensing.PrescriptionId);
        Assert.Equal(patientId, dispensing.PatientId);
        Assert.Equal("DISP-000001", dispensing.DispensingNumber);
        Assert.Equal(userId, dispensing.DispensedByUserId);
        Assert.Equal(DispensingStatus.PartiallyDispensed, dispensing.Status);
        Assert.Equal("Test Notes", dispensing.Notes);
        Assert.Equal(Now, dispensing.DispensedAt);
        Assert.Empty(dispensing.Items);
    }

    [Fact]
    public void AddingItemToDispensingAppendsToItemsCollection()
    {
        var tenantId = Guid.NewGuid();
        var rxId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var rxItemId = Guid.NewGuid();
        var invItemId = Guid.NewGuid();
        var stockMovId = Guid.NewGuid();

        var dispensing = new PharmacyDispensing(
            tenantId, rxId, patientId, "DISP-000001", userId, DispensingStatus.PartiallyDispensed, null, Now
        );

        var item = dispensing.AddItem(rxItemId, invItemId, 10m, 5m, 50m, stockMovId, Now);

        Assert.Single(dispensing.Items);
        Assert.Equal(dispensing.Id, item.DispensingId);
        Assert.Equal(rxItemId, item.PrescriptionItemId);
        Assert.Equal(invItemId, item.InventoryItemId);
        Assert.Equal(10m, item.QuantityDispensed);
        Assert.Equal(5m, item.UnitCost);
        Assert.Equal(50m, item.TotalCost);
        Assert.Equal(stockMovId, item.StockMovementId);
    }

    [Fact]
    public void MarkingDispensingAsFullyDispensedUpdatesStatus()
    {
        var dispensing = new PharmacyDispensing(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DISP-000001", Guid.NewGuid(), DispensingStatus.PartiallyDispensed, null, Now
        );

        dispensing.MarkFullyDispensed(Now);

        Assert.Equal(DispensingStatus.FullyDispensed, dispensing.Status);
    }

    [Fact]
    public void ReversingDispensingUpdatesStatusAndPreventsFurtherEdits()
    {
        var dispensing = new PharmacyDispensing(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DISP-000001", Guid.NewGuid(), DispensingStatus.FullyDispensed, null, Now
        );

        dispensing.MarkReversed(Now);

        Assert.Equal(DispensingStatus.Reversed, dispensing.Status);

        Assert.Throws<PharmacyDispensingException>(() => dispensing.MarkReversed(Now));
        Assert.Throws<PharmacyDispensingException>(() => dispensing.MarkFullyDispensed(Now));
        Assert.Throws<PharmacyDispensingException>(() => dispensing.AddItem(Guid.NewGuid(), Guid.NewGuid(), 1m, 1m, 1m, Guid.NewGuid(), Now));
    }

    [Fact]
    public void PharmacyDispensingReversalRecordStoresCorrectData()
    {
        var tenantId = Guid.NewGuid();
        var dispensingId = Guid.NewGuid();
        var reversedBy = Guid.NewGuid();
        var stockMovId = Guid.NewGuid();

        var reversal = new PharmacyDispensingReversal(
            tenantId,
            dispensingId,
            reversedBy,
            Now,
            "Damaged item returned",
            stockMovId
        );

        Assert.Equal(tenantId, reversal.TenantId);
        Assert.Equal(dispensingId, reversal.DispensingId);
        Assert.Equal(reversedBy, reversal.ReversedByUserId);
        Assert.Equal(Now, reversal.ReversedAt);
        Assert.Equal("Damaged item returned", reversal.Reason);
        Assert.Equal(stockMovId, reversal.StockMovementId);
    }
}
