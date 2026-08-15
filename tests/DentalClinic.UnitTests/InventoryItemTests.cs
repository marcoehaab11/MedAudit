using DentalClinic.Domain.Inventory;
using Xunit;

namespace DentalClinic.UnitTests;

public class InventoryItemTests
{
    [Fact]
    public void InventoryItemCreationValidatesInputs()
    {
        var tenantId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var item = new InventoryItem(
            tenantId, "Dental Needles 30G", "إبر أسنان 30G", "NEEDLE-30G",
            categoryId, "Box", true, 5m, 10m, 75m, "Sterile needles", null, DateTimeOffset.UtcNow
        );

        Assert.Equal("Dental Needles 30G", item.Name);
        Assert.Equal("NEEDLE-30G", item.Sku);
        Assert.Equal(5m, item.MinimumStockLevel);
        Assert.Equal(75m, item.CurrentCost);
    }

    [Fact]
    public void StockMovementCreationValidatesPositiveQuantity()
    {
        var tenantId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var movement = new StockMovement(
            tenantId, itemId, StockMovementType.Receipt, 50m, 75m, 3750m,
            DateTimeOffset.UtcNow, "PO-1001", null, userId, "Initial stock"
        );

        Assert.Equal(50m, movement.Quantity);
        Assert.Equal(3750m, movement.TotalCost);
        Assert.Equal(StockMovementType.Receipt, movement.MovementType);
    }

    [Fact]
    public void StockMovementThrowsForNonPositiveQuantity()
    {
        var tenantId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        Assert.Throws<ArgumentOutOfRangeException>(() => new StockMovement(
            tenantId, itemId, StockMovementType.Issue, 0m, 75m, null,
            DateTimeOffset.UtcNow, "REF-1", null, userId, null
        ));
    }
}
