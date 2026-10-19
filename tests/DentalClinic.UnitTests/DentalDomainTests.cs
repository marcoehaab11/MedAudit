using DentalClinic.Domain.Dental;

namespace DentalClinic.UnitTests;

public sealed class DentalDomainTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(DentalFindingType.Extraction)]
    [InlineData(DentalFindingType.Implant)]
    public void ChartSupportsExtractionAndImplantWithoutChangingHistoricalCodes(DentalFindingType type)
    {
        var examination = Create();
        examination.AddFinding(36, type, [], null, Actor, examination.Version, Now);
        Assert.Equal(type, Assert.Single(examination.Findings).FindingType);
        Assert.Equal(3, (int)DentalFindingType.Fracture);
        Assert.Equal(4, (int)DentalFindingType.Missing);
    }

    [Theory]
    [InlineData(DentalFindingType.ScalingAndPolishing)]
    [InlineData(DentalFindingType.Whitening)]
    [InlineData(DentalFindingType.Orthodontics)]
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
    public void AllClassesCanBeStoredRegardlessOfToothPosition(int tooth, int classification)
    {
        var examination = Create();
        var finding = examination.AddFinding(tooth, DentalFindingType.Caries,
            [], null, Actor, examination.Version, Now, classification);
        Assert.Equal(classification, finding.CariesClass);
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
    public void RootCanalSessionPreservesStageFilesAndUnmeasuredCanals()
    {
        var examination = Create(); var treatmentId = Guid.NewGuid();
        var record = examination.AddEndodonticRecord(26, "Continue shaping", [new("MB", 21.5m, null, "25/.06"), new("MB2", null, null)], Actor, examination.Version, Now, RootCanalStage.CleaningAndShaping, treatmentId);
        Assert.Equal(RootCanalStage.CleaningAndShaping, record.Stage); Assert.Equal(treatmentId, record.TreatmentId);
        Assert.Equal("25/.06", record.Canals.First().FinalFileSize); Assert.Null(record.Canals.Last().LengthMm);
        var originalCanalId = record.Canals.First().Id;
        var version = examination.Version;
        Assert.Throws<ArgumentOutOfRangeException>(() => examination.UpdateEndodonticRecord(record.Id, "Invalid change", [new("MB", 55, null)], version, Now, RootCanalStage.Obturation, treatmentId));
        Assert.Equal("Continue shaping", record.Notes); Assert.Equal(21.5m, record.Canals.First().LengthMm); Assert.Equal(version, examination.Version);
        Assert.Throws<ArgumentException>(() => examination.UpdateEndodonticRecord(record.Id, null, [new("MB", 21, null)], version, Now, RootCanalStage.Obturation, Guid.NewGuid()));
        examination.UpdateEndodonticRecord(record.Id, "Next: final restoration", [new("MB", 21.5m, null, "30/.06")], version, Now.AddDays(7), RootCanalStage.Obturation, treatmentId);
        Assert.Equal(RootCanalStage.Obturation, record.Stage); Assert.Equal("30/.06", Assert.Single(record.Canals).FinalFileSize);
        Assert.Equal(originalCanalId, Assert.Single(record.Canals).Id);
        examination.UpdateEndodonticRecord(record.Id, "All four steps completed", [new("MB", 21.5m, null, "30/.06")], examination.Version, Now.AddDays(8), RootCanalStage.Completed, treatmentId);
        Assert.Equal(RootCanalStage.Completed, record.Stage);
        Assert.Equal(originalCanalId, Assert.Single(record.Canals).Id);

    }

    [Theory]
    [InlineData("fiber")]
    [InlineData("metal")]
    [InlineData("custom")]
    public void PostAndCorePersistsWorkflowAndRequiresPostTypeToComplete(string postType)
    {
        var examination = Create();
        var record = examination.AddEndodonticRecord(26, null, [new("MB", 21, null, "25")], Actor, examination.Version, Now, RootCanalStage.PostAndCore, restorationType: "post-core-crown", postType: postType);
        Assert.Equal(postType, record.PostType); Assert.Equal("post-core-crown", record.RestorationType);
        Assert.Throws<ArgumentException>(() => examination.UpdateEndodonticRecord(record.Id, null, [new("MB", 21, null, "25")], examination.Version, Now, RootCanalStage.Completed, restorationType: "post-core-crown"));
        examination.UpdateEndodonticRecord(record.Id, null, [new("MB", 21, null, "25")], examination.Version, Now, RootCanalStage.Crown, restorationType: "post-core-crown", postType: postType);
        examination.UpdateEndodonticRecord(record.Id, null, [new("MB", 21, null, "25")], examination.Version, Now, RootCanalStage.Completed, restorationType: "post-core-crown", postType: postType);
        Assert.Equal(RootCanalStage.Completed, record.Stage); Assert.Equal(postType, record.PostType);
    }

    [Fact]
    public void PostCanalMustBeOneOfThisToothsCanalsAndIsSavedWithThePost()
    {
        var examination = Create();
        var record = examination.AddEndodonticRecord(24, null, [new("B", 21, null), new("P", 20, null)], Actor, examination.Version, Now, RootCanalStage.PostAndCore, restorationType: "post-core", postType: "fiber", postCanal: "P");
        Assert.Equal("P", record.PostCanal);
        Assert.Throws<ArgumentException>(() => examination.UpdateEndodonticRecord(record.Id, null, [new("B", 21, null), new("P", 20, null)], examination.Version, Now, RootCanalStage.PostAndCore, restorationType: "post-core", postType: "fiber", postCanal: "MB2"));
        Assert.Equal("P", record.PostCanal);
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
