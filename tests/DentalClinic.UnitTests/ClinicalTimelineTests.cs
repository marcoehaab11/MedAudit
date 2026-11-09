using DentalClinic.Application.Patients;
using DentalClinic.Domain.Dental;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.UnitTests;

public sealed class ClinicalTimelineTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 9, 22, 15, 0, TimeSpan.Zero);
    private static readonly EndodonticCanalInput[] Canals = [new("MB", 21, null, "30")];
    private static Treatment New(TreatmentType type = TreatmentType.Filling, string name = "Composite Filling") =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, Guid.NewGuid(), null, type, name, [36], 100, "Filling material: Composite", Now);

    [Fact]
    public void PartialFillingShowsOnlyThePerformedStepAndRetainsEveryVisitWithoutDuplicates()
    {
        var treatment = New(); var firstVisit = treatment.AppointmentId!.Value; var nextVisit = Guid.NewGuid();
        Assert.Empty(ClinicalTimeline.TreatmentEvents(treatment));
        treatment.RecordFillingStep("caries-removal", firstVisit, Now);
        treatment.RecordFillingStep("caries-removal", firstVisit, Now.AddHours(1));
        var first = Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)); Assert.Equal("caries-removal", first.Step); Assert.Equal(Now, first.PerformedAt);
        treatment.RecordFillingStep("temporary-filling", nextVisit, Now.AddDays(1));
        Assert.Equal(2, ClinicalTimeline.TreatmentEvents(treatment).Count());
        treatment.Complete(treatment.Version, Now.AddDays(2), nextVisit);
        var history = ClinicalTimeline.TreatmentEvents(treatment).ToArray(); Assert.Equal(3, history.Length);
        Assert.Equal("composite-filling", history.Last().Step); Assert.Equal(nextVisit, history.Last().AppointmentId);
        Assert.Equal(first.Id,history.First().Id);Assert.Equal(first.PerformedAt,history.First().PerformedAt);Assert.Equal(first.AppointmentId,history.First().AppointmentId);Assert.Equal(first.ToothNumbers,history.First().ToothNumbers);
        Assert.Throws<TreatmentStateException>(() => treatment.RecordFillingStep("caries-removal", nextVisit, Now.AddDays(3)));
    }
    [Fact]
    public void CancellingAnUnfinishedTreatmentDoesNotEraseItsExecutedStepOrInventCompletion()
    {
        var treatment=New();treatment.RecordFillingStep("caries-removal",treatment.AppointmentId!.Value,Now);
        treatment.Cancel(treatment.Version,Now.AddDays(1));
        Assert.Equal("caries-removal",Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)).Step);
    }
    [Fact]
    public void ALinkedRootComponentCannotReceiveGenericFillingStepsOutsideItsOwnFlow()
    {
        var treatment=New();treatment.LinkFlowComponent(Guid.NewGuid(),"core");
        Assert.Throws<TreatmentStateException>(()=>treatment.RecordFillingStep("caries-removal",treatment.AppointmentId!.Value,Now));
        Assert.Empty(ClinicalTimeline.TreatmentEvents(treatment));
    }
    [Fact]
    public void RootNextStageNeverAppearsAsAnExecutedStep()
    {
        var treatment = New(TreatmentType.RootCanal, "Root canal");
        var state = RootTreatmentFlow.Save(null, """{"version":1,"needsPost":false,"needsCrown":false,"progress":{"access":{"completed":true}},"crown":{"completed":[false,false,false,false,false]}}""",
            Canals, false, Guid.NewGuid(), treatment.AppointmentId!.Value, Guid.NewGuid(), Now);
        treatment.SaveRootFlow(state.ToJsonString(), treatment.Version, Now);
        Assert.Equal(2, RootTreatmentFlow.NextStage(state));
        var actual = Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)); Assert.Equal("access", actual.Step);
        Assert.DoesNotContain(ClinicalTimeline.TreatmentEvents(treatment), e => e.Step is "length" or "obturation" or "core");
    }
    [Fact]
    public void FutureCrownStepsDoNotAppearAfterPreparation()
    {
        var treatment = New(TreatmentType.Crown, "Crown");
        var state = RootTreatmentFlow.Save(null, """{"version":1,"progress":{"crown-preparation":{"completed":true}},"crown":{"completed":[true,false,false,false,false]}}""",
            [], true, Guid.NewGuid(), treatment.AppointmentId!.Value, Guid.NewGuid(), Now);
        treatment.SaveRootFlow(state.ToJsonString(), treatment.Version, Now);
        Assert.Equal("crown-preparation", Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)).Step);
    }
    [Fact]
    public void BleachingDraftsAreExcludedAndEditingAPerformedSessionKeepsItsOriginalTime()
    {
        var treatment = New(TreatmentType.Other, "Bleaching"); var session = Guid.NewGuid();
        const string plan = """{"plannedSessions":2,"baselineShade":"A3","treatmentType":"in-office"}""";
        const string data = """{"brand":"Custom product","concentration":"Manufacturer specified","durationMinutes":20,"shadeAfter":"B1","sensitivity":"none"}""";
        void Save(bool performed, DateTimeOffset at) => treatment.SaveClinicalWorkflow("bleaching", plan, session, treatment.AppointmentId!.Value, Guid.NewGuid(),
            new DateOnly(2026,11,9), data, performed, treatment.Version, at);
        Save(false, Now); Assert.Empty(ClinicalTimeline.TreatmentEvents(treatment));
        Save(true, Now.AddMinutes(1)); Save(true, Now.AddHours(1));
        var recorded = Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)); Assert.Equal("bleaching", recorded.Step); Assert.Equal(Now.AddMinutes(1), recorded.PerformedAt);
        treatment.RetractClinicalSession(session, Guid.NewGuid(), "Wrong visit was selected", treatment.Version, Now.AddHours(2));
        Assert.True(Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)).Corrected);
    }
    [Fact]
    public void ScalingRecordedAtTheAssessmentIsNotLostWhilePolishingIsStillPending()
    {
        var treatment = New(TreatmentType.Other,"Scaling"); var session=Guid.NewGuid();
        const string data="""{"scope":"full","calculus":"moderate","gingivalStatus":"healthy","scalingPerformed":true,"pocketMapping":"no"}""";
        treatment.SaveClinicalWorkflow("scaling","{}",session,treatment.AppointmentId!.Value,Guid.NewGuid(),new DateOnly(2026,11,9),data,false,treatment.Version,Now,"scaling");
        var step=Assert.Single(ClinicalTimeline.TreatmentEvents(treatment)); Assert.Equal("scaling",step.Step);
        Assert.DoesNotContain(ClinicalTimeline.TreatmentEvents(treatment),e=>e.Step=="polishing");
    }
    [Fact]
    public void DayAndTimeUseTheClinicTimeZoneAndMissingHistoricalTimesAreNotFabricated()
    {
        var e = ClinicalTimeline.Event("x",null,null,[],"Treatment","extraction",Now);
        var local = ClinicalTimeline.InZone(e, TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo"));
        Assert.Equal("2026-11-10",local.Date);Assert.Equal("Tuesday",local.DayEn);Assert.Equal("00:15:00",local.Time);
        var unknown=ClinicalTimeline.InZone(e with { PerformedAt=null, ReportedDate="2026-11-08" },TimeZoneInfo.Utc);
        Assert.Equal("2026-11-08",unknown.Date);Assert.Null(unknown.Time);Assert.Null(unknown.PerformedAt);
    }
    [Fact]
    public void LegacyRootNextStageIsNotAnEventButExplicitCrownExecutionKeepsItsDateWithoutInventingATime()
    {
        var record=Guid.NewGuid();var treatment=Guid.NewGuid();
        Assert.Empty(ClinicalTimeline.LegacyRootEvents(record,treatment,null,36,"""{"stage":4,"crown":{"completed":[false,false,false,false,false]}}""","Root"));
        var saved=Assert.Single(ClinicalTimeline.LegacyRootEvents(record,treatment,null,36,
            """{"stage":8,"crown":{"completed":[true,false,false,false,false],"dates":["2026-11-01","","","",""]}}""","Crown"));
        Assert.Equal("crown-preparation",saved.Step);Assert.Null(saved.PerformedAt);
        var local=ClinicalTimeline.InZone(saved,TimeZoneInfo.Utc);Assert.Equal("2026-11-01",local.Date);Assert.Null(local.Time);
    }
}
