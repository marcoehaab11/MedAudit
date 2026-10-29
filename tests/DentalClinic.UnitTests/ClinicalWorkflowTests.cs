using System.Text.Json.Nodes;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.UnitTests;

public sealed class ClinicalWorkflowTests
{
    private static readonly Guid Doctor = Guid.NewGuid();
    private static readonly Guid Actor = Guid.NewGuid();
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    private const string BleachingPlan = """{"plannedSessions":2,"baselineShade":"A3","treatmentType":"in-office"}""";
    private const string BleachingData = """{"brand":"Custom product","concentration":"Manufacturer specified","durationMinutes":20,"shadeAfter":"B1","sensitivity":"none"}""";
    private static string Save(string? previous, Guid session, Guid appointment, bool performed = true, string plan = BleachingPlan) =>
        ClinicalWorkflow.Save(previous, "bleaching", plan, session, appointment, Doctor, Actor, new DateOnly(2026, 10, 29), BleachingData, performed, Now);

    [Fact]
    public void DraftsAndRepeatedSavesNeverIncreasePerformedSessionCount()
    {
        var session = Guid.NewGuid(); var appointment = Guid.NewGuid();
        var json = Save(null, session, appointment, false);
        Assert.Equal(0, ClinicalWorkflow.CompletedCount(JsonNode.Parse(json)!.AsObject()));
        Assert.Throws<TreatmentStateException>(() => ClinicalWorkflow.EnsureComplete(json));
        json = Save(json, session, appointment);
        json = Save(json, session, appointment);
        var root = JsonNode.Parse(json)!.AsObject();
        Assert.Equal(1, ClinicalWorkflow.CompletedCount(root));
        Assert.Equal(2, root["visits"]![0]!["revisions"]!.AsArray().Count);
        Assert.Throws<TreatmentStateException>(() => ClinicalWorkflow.EnsureComplete(json));
        json = Save(json, Guid.NewGuid(), Guid.NewGuid());
        ClinicalWorkflow.EnsureComplete(json);
        Assert.Equal(2, ClinicalWorkflow.CompletedCount(JsonNode.Parse(json)!.AsObject()));
    }
    [Fact]
    public void CorrectionRetainsDataAndReasonWithoutDeletingTheSession()
    {
        var session = Guid.NewGuid(); var appointment = Guid.NewGuid(); var json = Save(null, session, appointment);
        json = ClinicalWorkflow.Retract(json, session, Actor, "Recorded against the wrong session", Now);
        var root = JsonNode.Parse(json)!.AsObject(); Assert.Equal(0, ClinicalWorkflow.CompletedCount(root)); Assert.Single(root["visits"]!.AsArray());
        Assert.Equal("B1", root["visits"]![0]!["data"]!["shadeAfter"]!.ToString());
        json = Save(json, session, appointment, false); root = JsonNode.Parse(json)!.AsObject(); Assert.Equal("Recorded against the wrong session", root["visits"]![0]!["correctionReason"]!.ToString());
    }
    [Fact]
    public void DuplicateVisitAndOverrunningPlanAndChangingBaselineAreRejected()
    {
        var session = Guid.NewGuid(); var appointment = Guid.NewGuid();
        var json = Save(null, session, appointment);
        Assert.Throws<ArgumentException>(() => Save(json, Guid.NewGuid(), appointment));
        Assert.Throws<ArgumentException>(() => Save(json, session, Guid.NewGuid()));
        Assert.Throws<TreatmentStateException>(() => Save(json, Guid.NewGuid(), Guid.NewGuid(), true, BleachingPlan.Replace("A3", "A2", StringComparison.Ordinal)));
        json = Save(json, Guid.NewGuid(), Guid.NewGuid());
        Assert.Throws<TreatmentStateException>(() => Save(json, Guid.NewGuid(), Guid.NewGuid()));
    }
    [Fact]
    public void ScalingNeedsSelectedQuadrantsAndExplicitlyPerformedScaling()
    {
        const string data = """{"scope":"quadrants","quadrants":[],"calculus":"moderate","gingivalStatus":"mild","scalingPerformed":true,"pocketMapping":"no","polishing":"no","sensitivity":"none"}""";
        var session = Guid.NewGuid(); var appointment = Guid.NewGuid();
        string Store(string value, bool performed) => ClinicalWorkflow.Save(null, "scaling", "{}", session, appointment, Doctor, Actor, new DateOnly(2026, 10, 29), value, performed, Now);
        Store(data, false);
        Assert.Throws<ArgumentException>(() => Store(data, true));
        var valid = data.Replace("[]", "[\"UR\"]", StringComparison.Ordinal);
        ClinicalWorkflow.EnsureComplete(Store(valid, true));
        Assert.Throws<TreatmentStateException>(() => Store(valid.Replace("true", "false", StringComparison.Ordinal), true));
    }
    [Fact]
    public void PocketMappingRequiresRealMeasurementsAndNeverAssumesTreatmentWasPerformed()
    {
        const string data = """{"scope":"full","calculus":"moderate","gingivalStatus":"mild","scalingPerformed":true,"pocketMapping":"yes","polishing":"no","sensitivity":"none","pockets":[{"tooth":16,"MB":4,"B":null,"treatment":"chlorhexidine","treatmentStatus":"planned"}]}""";
        string Store(string value) => ClinicalWorkflow.Save(null, "scaling", "{}", Guid.NewGuid(), Guid.NewGuid(), Doctor, Actor, new DateOnly(2026, 10, 29), value, true, Now);
        var json = Store(data); ClinicalWorkflow.EnsureComplete(json);
        Assert.Equal("planned", JsonNode.Parse(json)!["visits"]![0]!["data"]!["pockets"]![0]!["treatmentStatus"]!.ToString());
        Assert.Throws<ArgumentException>(() => Store(data.Replace("\"MB\":4", "\"MB\":0", StringComparison.Ordinal)));
        Assert.Throws<ArgumentException>(() => Store(data.Replace("\"MB\":4", "\"MB\":null", StringComparison.Ordinal)));
    }
}
