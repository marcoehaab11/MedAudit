namespace DentalClinic.Domain.Inventory;

public enum StockMovementType
{
    OpeningBalance = 1,
    Receipt = 2,
    Issue = 3,
    AdjustmentIncrease = 4,
    AdjustmentDecrease = 5,
    Return = 6
}
