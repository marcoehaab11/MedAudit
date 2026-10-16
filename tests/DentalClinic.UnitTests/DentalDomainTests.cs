using DentalClinic.Domain.Dental;

namespace DentalClinic.UnitTests;

public sealed class DentalDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(DentalFindingType.ScalingAndPolishing)]
    [InlineData(DentalFindingType.Whitening)]
    public void WholeMouthFindingsCoverAllTeethWithoutDuplicates(DentalFindingType type)
    {
        var examination = Create();
        examination.AddWholeMouthFinding(type, null, Actor, examination.Version, Now);
        Assert.Equal(32, examination.Findings.Count);
        Assert.All(examination.Findings, finding => Assert.Equal(type, finding.FindingType));
        examination.AddWholeMouthFinding(type, null, Actor, examination.Version, Now);
        Assert.Equal(32, examination.Findings.Count);
    }
    [Fact]
    public void WholeMouthFindingStillChecksTheDraftVersionAndRejectsToothSpecificDiagnosis()
    {
        var examination = Create();
        Assert.Throws<DentalConcurrencyException>(() => examination.AddWholeMouthFinding(DentalFindingType.Whitening, null, Actor, Guid.NewGuid(), Now));
        Assert.Throws<ArgumentException>(() => examination.AddWholeMouthFinding(DentalFindingType.Caries, null, Actor, examination.Version, Now));
        Assert.Empty(examination.Findings);
    }

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

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(5)]
    [InlineData(6)]
    public void CariesClassificationIsStoredAndClearedWhenDiagnosisChanges(int classification)
    {
        var examination = Create();
        var finding = examination.AddFinding(36, DentalFindingType.Caries, [], null,
            Actor, examination.Version, Now, classification);
        Assert.Equal(classification, finding.CariesClass);
        examination.UpdateFinding(finding.Id, DentalFindingType.Fracture, [], null, examination.Version, Now);
        Assert.Null(finding.CariesClass);
    }

    [Theory]
    [InlineData(11, 1)]
    [InlineData(13, 2)]
    [InlineData(36, 3)]
    [InlineData(24, 4)]
    public void ClassIncompatibleWithToothIsRejected(int tooth, int classification)
    {
        var examination = Create();
        Assert.Throws<ArgumentException>(() => examination.AddFinding(tooth, DentalFindingType.Caries,
            [], null, Actor, examination.Version, Now, classification));
    }

    [Theory]
    [InlineData(11, 3)]
    [InlineData(13, 4)]
    [InlineData(36, 1)]
    [InlineData(24, 2)]
    public void CompatibleClassIsStored(int tooth, int classification)
    {
        var examination = Create();
        var finding = examination.AddFinding(tooth, DentalFindingType.Caries, [], null, Actor, examination.Version, Now, classification);
        Assert.Equal(classification, finding.CariesClass);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    public void InvalidCariesClassificationIsRejected(int classification)
    {
        var examination = Create();
        Assert.Throws<ArgumentOutOfRangeException>(() => examination.AddFinding(36, DentalFindingType.Caries,
            [], null, Actor, examination.Version, Now, classification));
    }

    [Fact]
    public void NonCariesFindingCannotHaveCariesClassification()
    {
        var examination = Create();
        Assert.Throws<ArgumentException>(() => examination.AddFinding(36, DentalFindingType.Missing,
            [], null, Actor, examination.Version, Now, 2));
    }

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
