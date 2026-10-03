using DentalClinic.Domain.ClinicBusiness;

namespace DentalClinic.UnitTests;

public sealed class ClinicBusinessTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 3, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public void LabCaseTracksRemakeAndCannotCancelAfterBilling()
    {
        var item = new LabCase(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null,
            "Crown", "16", "Zirconia", "A2", "Margins in scan", Now.AddDays(4), 500, Now);
        Assert.Throws<ClinicBusinessConflictException>(() => item.SetStatus(LabCaseStatus.Fitted, null, Now));
        item.SetStatus(LabCaseStatus.Sent, null, Now.AddHours(1));
        item.SetStatus(LabCaseStatus.Delivered, null, Now.AddDays(3));
        item.SetStatus(LabCaseStatus.Fitted, null, Now.AddDays(4));
        item.SetStatus(LabCaseStatus.Remake, "Shade mismatch", Now.AddDays(5));
        Assert.Equal(1, item.RemakeCount);
        Assert.Equal("Shade mismatch", item.LastUpdateNote);
        item.AddToStatement(Guid.NewGuid());
        Assert.Throws<ClinicBusinessConflictException>(() => item.SetStatus(LabCaseStatus.Cancelled, null, Now.AddDays(6)));
    }

    [Fact]
    public void ClaimNeedsApprovedAmountBeforeSettlementBatch()
    {
        var item = new InsuranceClaim(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 750, 250, null, Now);
        Assert.Throws<ClinicBusinessConflictException>(() => item.AddToBatch(Guid.NewGuid()));
        Assert.Throws<ClinicBusinessConflictException>(() => item.SetStatus(InsuranceClaimStatus.Approved, null, null, null, null, Now));
        Assert.Throws<ClinicBusinessConflictException>(() => item.SetStatus(InsuranceClaimStatus.Approved, 900, null, null, null, Now));
        item.SetStatus(InsuranceClaimStatus.Approved, 700, "AUTH-1", null, null, Now);
        item.AddToBatch(Guid.NewGuid());
        Assert.Equal(700, item.ApprovedAmount);
        Assert.Throws<ClinicBusinessConflictException>(() => item.SetStatus(InsuranceClaimStatus.Cancelled, null, null, null, null, Now));
    }
}
