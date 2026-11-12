using System.Text.Json.Nodes;
using DentalClinic.Domain.Dental;

namespace DentalClinic.UnitTests;

public sealed class ImplantRecordTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;
    private static ImplantRecord Record() => new(Guid.NewGuid(), Guid.NewGuid(), 36, Guid.NewGuid(), Guid.NewGuid(), Now);
    private static JsonObject Workflow() => JsonNode.Parse("""
        {"schemaVersion":1,"planning":{"imaging":"cbct","timing":"delayed","graft":"no"},
         "placement":{"date":"2026-10-21","brand":"Straumann","system":"BLX","connection":"RC","diameter":4.1,"length":10,"placementType":"delayed","stability":"good","component":"healing"},
         "healingVisits":[{"id":"00000000-0000-0000-0000-000000000001","date":"2026-12-21","healingType":"transmucosal","status":"normal","softTissue":"healthy","mobility":"none","pain":"none","boneLevel":"stable","nextPlan":"prosthetic","bleeding":"no","suppuration":"no","radiograph":"xray"}],
         "abutment":{"date":"2027-05-22","type":"stock","brand":"Straumann","connection":"BLX","height":4,"angle":0},
         "scan":{"date":"2027-05-22","scanType":"digital","coping":"scanbody","crownType":"zirconia","shadeSystem":"vita","shade":"A2","delivery":"lab","laboratory":"Lab"},
         "fixation":{"date":"2027-06-22","retention":"screw","seating":"final","occlusion":"satisfactory","stability":"stable"},
         "followupVisits":[{"id":"00000000-0000-0000-0000-000000000002","date":"2027-09-22","healing":"excellent","crown":"stable","occlusion":"satisfactory","hygiene":"good","outcome":"successful"}]}
        """)!.AsObject();
    [Fact]
    public void MedicalHistoryRecordsApprovedStepsAndHealingVisitsWithoutTreatingDraftsAsPerformed()
    {
        var record = Record(); var workflow = Workflow();
        record.Save(workflow.ToJsonString(), null, record.Version, Now);
        Assert.Empty(DentalClinic.Application.Patients.ClinicalTimeline.ImplantEvents(record));
        record.Save(workflow.ToJsonString(), 1, record.Version, Now);
        record.Save(workflow.ToJsonString(), 1, record.Version, Now.AddHours(1));
        Assert.Equal("implant-1", Assert.Single(DentalClinic.Application.Patients.ClinicalTimeline.ImplantEvents(record)).Step);
        record.Save(workflow.ToJsonString(), 2, record.Version, Now.AddDays(1));
        workflow["healingVisits"]![0]!["nextPlan"] = "continue";
        var visitId = workflow["healingVisits"]![0]!["id"]!.ToString();
        record.Save(workflow.ToJsonString(), null, record.Version, Now.AddDays(2), visitId, 3);
        Assert.Equal(2, record.CompletedStep);
        var history = DentalClinic.Application.Patients.ClinicalTimeline.ImplantEvents(record).ToArray();
        Assert.Equal(3, history.Length); Assert.Equal("implant-healing", history.Last().Step); Assert.Equal(Now.AddDays(2), history.Last().PerformedAt);
        var next = workflow["healingVisits"]![0]!.DeepClone(); next["id"] = Guid.NewGuid().ToString(); workflow["healingVisits"]!.AsArray().Add(next);
        record.Save(workflow.ToJsonString(), null, record.Version, Now.AddDays(3));
        Assert.Equal(3, DentalClinic.Application.Patients.ClinicalTimeline.ImplantEvents(record).Count());
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), null, record.Version, Now.AddDays(3), visitId, 7));
        workflow["healingVisits"]!.AsArray().RemoveAt(0);
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), null, record.Version, Now.AddDays(4)));
    }
    [Fact]
    public void AllSevenStagesPersistAndCannotBeSkipped()
    {
        var record = Record(); var workflow = Workflow().ToJsonString();
        Assert.Throws<ArgumentException>(() => record.Save(workflow, 2, record.Version, Now));
        for (var step = 1; step <= 7; step++) record.Save(workflow, step, record.Version, Now);
        Assert.Equal(7, record.CompletedStep); Assert.Equal(workflow, record.WorkflowJson);
    }
    [Fact]
    public void HealingRequiresAnExplicitDecisionAndTemporaryCrownsCannotAdvance()
    {
        var record = Record(); var workflow = Workflow();
        record.Save(workflow.ToJsonString(), 1, record.Version, Now); record.Save(workflow.ToJsonString(), 2, record.Version, Now);
        workflow["healingVisits"]![0]!["nextPlan"] = "continue";
        record.Save(workflow.ToJsonString(), null, record.Version, Now);
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), 3, record.Version, Now));
        workflow["healingVisits"]![0]!["nextPlan"] = "prosthetic";
        for (var step = 3; step <= 5; step++) record.Save(workflow.ToJsonString(), step, record.Version, Now);
        workflow["fixation"]!["seating"] = "temporary";
        record.Save(workflow.ToJsonString(), null, record.Version, Now);
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), 6, record.Version, Now));
    }
    [Fact]
    public void GraftAndCementDetailsAreRequiredOnlyWhenChosen()
    {
        var record = Record(); var workflow = Workflow(); record.Save(workflow.ToJsonString(), 1, record.Version, Now);
        workflow["placement"]!["graftEnabled"] = true;
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), 2, record.Version, Now));
        workflow["placement"]!["graftEnabled"] = false;
        for (var step = 2; step <= 5; step++) record.Save(workflow.ToJsonString(), step, record.Version, Now);
        workflow["fixation"]!["retention"] = "cement";
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), 6, record.Version, Now));
        workflow["fixation"]!["cement"] = "Resin cement";
        record.Save(workflow.ToJsonString(), 6, record.Version, Now); Assert.Equal(6, record.CompletedStep);
    }
    [Fact]
    public void LaterFollowupsCanBeDraftedWithoutErasingTheCompletedVisitHistory()
    {
        var record = Record(); var workflow = Workflow();
        for (var step = 1; step <= 7; step++) record.Save(workflow.ToJsonString(), step, record.Version, Now);
        workflow["followupVisits"]!.AsArray().Add(new JsonObject { ["id"] = Guid.NewGuid().ToString() });
        record.Save(workflow.ToJsonString(), null, record.Version, Now);
        workflow["followupVisits"]![1]!["date"] = "2027-10-22";
        record.Save(workflow.ToJsonString(), null, record.Version, Now);
        Assert.Equal(7, record.CompletedStep);
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), 7, record.Version, Now));
        workflow["followupVisits"]!.AsArray().RemoveAt(0);
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), null, record.Version, Now));
    }
    [Fact]
    public void ConcurrentEditsAndDuplicateVisitIdentifiersAreRejected()
    {
        var record = Record(); var oldVersion = record.Version; var workflow = Workflow();
        record.Save(workflow.ToJsonString(), null, oldVersion, Now);
        Assert.Throws<DentalConcurrencyException>(() => record.Save(workflow.ToJsonString(), null, oldVersion, Now));
        workflow["healingVisits"]!.AsArray().Add(workflow["healingVisits"]![0]!.DeepClone());
        Assert.Throws<ArgumentException>(() => record.Save(workflow.ToJsonString(), null, record.Version, Now));
    }
}
