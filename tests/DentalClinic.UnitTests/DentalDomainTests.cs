using DentalClinic.Domain.Dental;

namespace DentalClinic.UnitTests;

public sealed class DentalDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(11)]
    [InlineData(18)]
    [InlineData(21)]
    [InlineData(28)]
    [InlineData(31)]
    [InlineData(38)]
    [InlineData(41)]
    [InlineData(48)]
    public void PermanentFdiNumbersHaveStableGuidIdentifiers(int number)
    {
        var tooth = PermanentToothCatalog.Get(number);
        Assert.Equal(number, tooth.Number); Assert.NotEqual(Guid.Empty, tooth.Id);
        Assert.Equal(tooth, PermanentToothCatalog.Get(number));
    }

    [Theory]
    [InlineData(10)]
    [InlineData(19)]
    [InlineData(20)]
    [InlineData(49)]
    [InlineData(55)]
    public void InvalidFdiNumbersAreRejected(int number) =>
        Assert.Throws<ArgumentOutOfRangeException>(() => PermanentToothCatalog.Get(number));

    [Fact]
    public void FindingsAndProceduresRemainSeparateAndSupportMultipleSurfaces()
    {
        var examination = Create();
        examination.AddFinding(36, DentalFindingType.Caries, [ToothSurface.Mesial, ToothSurface.Occlusal],
            "tooth note", Actor, examination.Version, Now.AddMinutes(1));
        examination.AddProcedure(36, DentalProcedureType.Filling, [ToothSurface.Mesial, ToothSurface.Occlusal],
            "procedure note", Actor, examination.Version, Now.AddMinutes(2));
        Assert.Equal(2, examination.Findings.Single().Surfaces.Count);
        Assert.Equal(2, examination.Procedures.Single().Surfaces.Count);
        Assert.Equal(DentalFindingType.Caries, examination.Findings.Single().FindingType);
        Assert.Equal(DentalProcedureType.Filling, examination.Procedures.Single().ProcedureType);
    }

    [Fact]
    public void WholeToothCannotBeCombinedWithIndividualSurfaces()
    {
        var examination = Create();
        Assert.Throws<ArgumentException>(() => examination.AddFinding(36, DentalFindingType.Missing,
            [ToothSurface.WholeTooth, ToothSurface.Root], null, Actor, examination.Version, Now));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(50.01)]
    public void InvalidCanalLengthsAreRejected(decimal length)
    {
        var examination = Create();
        Assert.Throws<ArgumentOutOfRangeException>(() => examination.AddEndodonticRecord(36, null,
            [new EndodonticCanalInput("MB", length, null)], Actor, examination.Version, Now));
    }

    [Fact]
    public void CompletedExaminationAndStaleVersionsAreProtected()
    {
        var examination = Create(); var stale = examination.Version;
        examination.UpdateNotes("draft", stale, Now.AddMinutes(1));
        Assert.Throws<DentalConcurrencyException>(() => examination.AddFinding(11, DentalFindingType.Healthy,
            [], null, Actor, stale, Now.AddMinutes(2)));
        examination.Complete(examination.Version, Now.AddMinutes(3));
        Assert.Equal(ExaminationStatus.Completed, examination.Status);
        Assert.Throws<DentalStateException>(() => examination.UpdateNotes("rewrite", examination.Version, Now.AddMinutes(4)));
    }

    private static Examination Create() => new(Tenant, Guid.NewGuid(), Guid.NewGuid(), Actor, Actor, Now);
}
