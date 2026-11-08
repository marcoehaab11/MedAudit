using System.Text.Json.Nodes;
using DentalClinic.Domain.Dental;

namespace DentalClinic.UnitTests;

public sealed class RootTreatmentFlowTests
{
    private static readonly Guid Doctor = Guid.NewGuid();
    private static readonly Guid Visit = Guid.NewGuid();
    private static readonly Guid Appointment = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 11, 8, 10, 0, 0, TimeSpan.Zero);
    private static readonly EndodonticCanalInput[] Canals = [new("MB", 21, null, "30")];
    private const string Initial = """{"version":1,"needsPost":false,"needsCrown":false,"obturationDone":false,"finalMaterial":null,"crown":{"completed":[false,false,false,false,false],"type":"Crown","material":"Zirconia","shade":"A2","laboratory":"Lab"}}""";
    private static JsonObject Save(JsonObject? old, Action<JsonObject> change, Guid? visit = null)
    {
        var draft = RootTreatmentFlow.Parse(old?.ToJsonString() ?? Initial); change(draft);
        return RootTreatmentFlow.Save(old?.ToJsonString(), draft.ToJsonString(), Canals, false, visit ?? Visit, Appointment, Doctor, Now);
    }
    private static JsonObject Step(JsonObject? old, string key) => Save(old, draft =>
    { draft["progress"] ??= new JsonObject(); draft["progress"]![key] = new JsonObject { ["completed"] = true, ["completedAt"] = "2000-01-01", ["doctorUserId"] = Guid.Empty.ToString() }; });
    private static JsonObject Obturation()
    {
        var state = Step(null, "access"); state = Step(state, "length");
        state = Save(state, d => d["obturationDone"] = true); return Step(state, "obturation");
    }
    [Fact]
    public void CompletedStepsKeepVerifiedDateAndDoctorAcrossVisitsAndRetries()
    {
        var state = Step(null, "access"); var saved = state["progress"]!["access"]!.ToJsonString();
        Assert.Equal(Doctor.ToString(), state["progress"]!["access"]!["doctorUserId"]!.ToString());
        Assert.Equal(Now, DateTimeOffset.Parse(state["progress"]!["access"]!["completedAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture));
        state = Save(state, d => d["progress"]!["access"] = new JsonObject { ["completed"] = false }, Guid.NewGuid());
        Assert.Equal(saved, state["progress"]!["access"]!.ToJsonString()); Assert.Equal(2, RootTreatmentFlow.NextStage(state));
        var independentTooth = Save(null, _ => { }); Assert.Equal(1, RootTreatmentFlow.NextStage(independentTooth));
    }
    [Fact]
    public void TemporaryFillingIsRecordedOncePerVisitAndPermanentCoreRemainsPending()
    {
        var state = Obturation(); state = Save(state, d => { d["finalMaterial"] = "temporary"; d["temporaryRequested"] = true; });
        state = Save(state, d => d["temporaryRequested"] = true);
        Assert.Single(state["temporaryFillings"]!.AsArray()); Assert.Equal(5, RootTreatmentFlow.NextStage(state));
        Assert.False(RootTreatmentFlow.Done(state["progress"]!.AsObject(), "core"));
        state = Save(state, d => d["finalMaterial"] = "composite"); state = Step(state, "core");
        Assert.Equal(9, RootTreatmentFlow.NextStage(state));
        state = Save(state, d => d["decisionsMade"] = true); Assert.Equal(6, RootTreatmentFlow.NextStage(state));
    }
    [Fact]
    public void PostAndCrownAreExplicitPlansAndEachRequiresItsOwnCompletion()
    {
        var state = Obturation(); state = Save(state, d => d["finalMaterial"] = "composite"); state = Step(state, "core");
        state = Save(state, d => { d["decisionsMade"] = true; d["needsPost"] = true; d["needsCrown"] = true; });
        Assert.Equal(7, RootTreatmentFlow.NextStage(state));
        Assert.Throws<ArgumentException>(() => Step(state, "post"));
        state = Save(state, d => { d["postType"] = "fiber"; d["postCanal"] = "MB"; d["postSize"] = "2"; d["postDone"] = true; });
        state = Step(state, "post"); Assert.Equal(8, RootTreatmentFlow.NextStage(state));
        var beforeCrown = state;
        Assert.Throws<DentalStateException>(() => Save(beforeCrown, d => d["crown"]!["completed"]![3] = true));
        foreach (var index in new[] { 0, 1, 3, 4 }) state = Save(state, d => d["crown"]!["completed"]![index] = true);
        Assert.Equal(6, RootTreatmentFlow.NextStage(state));
    }
    [Fact]
    public void HarmlessWhitespaceDoesNotMakeSavedMeasurementsImpossibleToResume()
    {
        var state = Step(null, "access"); var draft = state.DeepClone().AsObject();
        draft["progress"]!["length"] = new JsonObject { ["completed"] = true };
        state = RootTreatmentFlow.Save(state.ToJsonString(), draft.ToJsonString(), [new(" MB ", 21, "  ", " 30 ")], false, Visit, Appointment, Doctor, Now);
        var resumed = RootTreatmentFlow.Save(state.ToJsonString(), state.ToJsonString(), Canals, false, Guid.NewGuid(), Appointment, Doctor, Now);
        Assert.Equal(4, RootTreatmentFlow.NextStage(resumed));
    }
    [Fact]
    public void SavedFlowVisitCannotBeDeletedThroughTheOldRecordControls()
    {
        var examination = new Examination(Guid.NewGuid(), Guid.NewGuid(), Appointment, Doctor, Doctor, Now);
        var record = examination.AddEndodonticRecord(26, null, Canals, Doctor, examination.Version, Now,
            RootCanalStage.AccessOpening, Guid.NewGuid(), "composite", workflowJson: """{"version":1,"flowVersion":2}""");
        Assert.Throws<DentalStateException>(() => examination.RemoveEndodonticRecord(record.Id, examination.Version, Now));
        Assert.Single(examination.EndodonticRecords);
    }
    [Fact]
    public void StaleWritesAndChangedCompletedMeasurementsCannotReplaceSavedProgress()
    {
        var state = Step(null, "access"); var stale = state.ToJsonString(); state = Step(state, "length");
        Assert.Throws<DentalConcurrencyException>(() => RootTreatmentFlow.Save(state.ToJsonString(), stale, Canals, false, Visit, Appointment, Doctor, Now));
        Assert.Throws<DentalStateException>(() => RootTreatmentFlow.Save(state.ToJsonString(), state.ToJsonString(), [new("MB", 23, null, "30")], false, Visit, Appointment, Doctor, Now));
        Assert.Throws<DentalStateException>(() => Step(null, "core"));
    }
}
