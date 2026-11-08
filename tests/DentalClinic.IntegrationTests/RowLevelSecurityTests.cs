using System.Security.Claims;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DentalClinic.Api.Endpoints;
using DentalClinic.Api.Extensions;
using DentalClinic.Api.Middleware;
using DentalClinic.Application;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Notifications;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Treatments;
using DentalClinic.Application.PublicBooking;
using DentalClinic.Infrastructure;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using Npgsql;
using Testcontainers.PostgreSql;

namespace DentalClinic.IntegrationTests;

// These tests deliberately bypass application query filters and use a real, non-owner login.
public sealed partial class RowLevelSecurityTests(RowSecurityDatabase database) : IClassFixture<RowSecurityDatabase>
{
    private static readonly string[] AllBackupModules = ["all"];
    private static readonly string[] ClinicalProductConcentrations = ["Label value"];
    [Fact]
    public async Task BleachingCannotCompleteBeforeEveryDistinctPlannedVisitIsSaved()
    {
        using var scope=database.Scope(database.AdminA);var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();var now=DateTimeOffset.UtcNow;
        var catalog=new TreatmentCatalogItem(database.TenantA,TreatmentType.Other,"Bleaching","BLEACH",null,0,now);db.TreatmentCatalogItems.Add(catalog);
        var appointmentIds=new List<Guid>();
        for(var day=26;day<=27;day++)
        {
            var id=await scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Appointments.ICreateAppointment>().ExecuteAsync(new(database.PatientA,database.DoctorA,DentalClinic.Domain.Appointments.AppointmentType.FollowUp,new(DateOnly.FromDateTime(now.AddDays(day).DateTime),new TimeOnly(12,0),30),"Bleaching test"),CancellationToken.None);
            appointmentIds.Add(id);var appointment=await db.Appointments.SingleAsync(x=>x.Id==id);appointment.CheckIn(now);appointment.Start(now);
            db.Examinations.Add(new DentalClinic.Domain.Dental.Examination(database.TenantA,database.PatientA,id,database.MemberA,database.AdminA,now));
        }
        var treatment=new Treatment(database.TenantA,database.PatientA,database.DoctorA,appointmentIds[0],null,null,catalog.Id,null,TreatmentType.Other,"Bleaching",[26],0,null,now,priceConfirmed:false);db.Treatments.Add(treatment);await db.SaveChangesAsync();
        var service=scope.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ClinicalWorkflowService>();
        var treatments=scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Treatments.ITreatmentService>();
        var plan=JsonSerializer.SerializeToElement(new{plannedSessions=2,baselineShade="A3",treatmentType="in-office",products=new[]{new{name="Test product",concentrations=ClinicalProductConcentrations}}});
        var data=JsonSerializer.SerializeToElement(new{brand="Test product",concentration="Label value",durationMinutes=20,shadeAfter="B1",sensitivity="none"});
        var first=Guid.NewGuid();var record=await service.SaveAsync(treatment.Id,new(treatment.Version,"bleaching",plan,first,appointmentIds[0],data,true),CancellationToken.None);
        await Assert.ThrowsAsync<TreatmentStateException>(()=>treatments.TransitionAsync(treatment.Id,"complete",record.Version,CancellationToken.None));
        record=await service.SaveAsync(treatment.Id,new(record.Version,"bleaching",plan,first,appointmentIds[0],data,true),CancellationToken.None);
        Assert.Equal(1,ClinicalWorkflow.CompletedCount(System.Text.Json.Nodes.JsonNode.Parse(record.WorkflowJson!)!.AsObject()));
        record=await service.SaveAsync(treatment.Id,new(record.Version,"bleaching",plan,Guid.NewGuid(),appointmentIds[1],data,true),CancellationToken.None);
        Assert.True(await treatments.TransitionAsync(treatment.Id,"complete",record.Version,CancellationToken.None));
        Assert.Equal(TreatmentStatus.Completed,(await db.Treatments.SingleAsync(x=>x.Id==treatment.Id)).Status);
    }
    [Fact]
    public async Task ClinicalSessionsPhotosAndReceptionRequestPersistWithoutDuplicatesAndRejectOtherClinics()
    {
        using var scope=database.Scope(database.AdminA);
        var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();var now=DateTimeOffset.UtcNow;
        var role=new TenantRole(database.TenantA,SystemRoleDefinitions.Receptionist,"Reception",true,now);
        db.TenantRoles.Add(role);db.UserRoleAssignments.Add(new UserRoleAssignment(database.TenantA,database.ColleagueA,role.Id,now));
        var catalog=new TreatmentCatalogItem(database.TenantA,TreatmentType.Other,"Scaling and polishing","SCALING",null,0,now);db.TreatmentCatalogItems.Add(catalog);
        var appointmentId=await scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Appointments.ICreateAppointment>().ExecuteAsync(
            new(database.PatientA,database.DoctorA,DentalClinic.Domain.Appointments.AppointmentType.FollowUp,new(DateOnly.FromDateTime(now.AddDays(25).DateTime),new TimeOnly(11,0),30),"Scaling workflow test"),CancellationToken.None);
        var appointment=await db.Appointments.SingleAsync(x=>x.Id==appointmentId);appointment.CheckIn(now);appointment.Start(now);
        db.Examinations.Add(new DentalClinic.Domain.Dental.Examination(database.TenantA,database.PatientA,appointmentId,database.MemberA,database.AdminA,now));
        var treatment=new Treatment(database.TenantA,database.PatientA,database.DoctorA,appointmentId,null,null,catalog.Id,null,TreatmentType.Other,"Scaling and polishing",[36],0,null,now,priceConfirmed:false);
        db.Treatments.Add(treatment);await db.SaveChangesAsync();
        var service=scope.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ClinicalWorkflowService>();
        var sessionId=Guid.NewGuid();var data=JsonSerializer.SerializeToElement(new{scope="full",calculus="moderate",gingivalStatus="mild",scalingPerformed=true,pocketMapping="no",polishing="no",sensitivity="none",requestRecall=true,recallDate=DateOnly.FromDateTime(now.AddDays(55).DateTime).ToString("yyyy-MM-dd",System.Globalization.CultureInfo.InvariantCulture),recallReason="Review after scaling"});
        var plan=JsonSerializer.SerializeToElement(new{});
        var record=await service.SaveAsync(treatment.Id,new(treatment.Version,"scaling",plan,sessionId,appointmentId,data,true),CancellationToken.None);
        record=await service.SaveAsync(treatment.Id,new(record.Version,"scaling",plan,sessionId,appointmentId,data,true),CancellationToken.None);
        Assert.Single(await db.FollowUps.Where(x=>x.RelatedTreatmentId==treatment.Id).ToListAsync());
        Assert.Equal(1,ClinicalWorkflow.CompletedCount(System.Text.Json.Nodes.JsonNode.Parse(record.WorkflowJson!)!.AsObject()));
        var photo=await service.AddPhotoAsync(treatment.Id,sessionId,"before","test.png",[137,80,78,71,13,10,26,10,0],CancellationToken.None);
        Assert.Single(await service.PhotosAsync(treatment.Id,CancellationToken.None));
        using(var other=database.Scope(database.MemberB)){
            var otherDb=other.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Empty(await otherDb.ClinicalPhotos.IgnoreQueryFilters().Where(x=>x.Id==photo.Id).ToListAsync());
            Assert.Equal(0,await otherDb.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM clinical_photos WHERE \"Id\"={photo.Id}"));
        }
        using var restored=database.Scope(database.AdminA);
        var restoredService=restored.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ClinicalWorkflowService>();
        Assert.Equal("test.png",(await restoredService.PhotoAsync(treatment.Id,photo.Id,CancellationToken.None)).FileName);
        await restoredService.DeletePhotoAsync(treatment.Id,photo.Id,CancellationToken.None);
        await using var app=await database.HttpAppAsync();using var client=app.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized,(await client.GetAsync($"/api/treatments/{treatment.Id}/clinical-workflow")).StatusCode);
    }
    [Fact]
    public async Task ImplantCompletionUsesTheExistingTreatmentWorkflowAndCannotBypassClinicalSteps()
    {
        using var scope = database.Scope(database.AdminA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var catalog = new TreatmentCatalogItem(database.TenantA, TreatmentType.Implant, "Implant", "IMPLANT-TEST", null, 0, DateTimeOffset.UtcNow);
        db.TreatmentCatalogItems.Add(catalog);
        var appointmentId = await scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Appointments.ICreateAppointment>()
            .ExecuteAsync(new(database.PatientA, database.DoctorA, DentalClinic.Domain.Appointments.AppointmentType.FollowUp,
                new(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)), new TimeOnly(10, 0), 30), "Implant completion test"), CancellationToken.None);
        var treatment = new Treatment(database.TenantA, database.PatientA, database.DoctorA, appointmentId, null, null, catalog.Id, null,
            TreatmentType.Implant, "Implant", [35], 0, null, DateTimeOffset.UtcNow, priceConfirmed: false);
        db.Treatments.Add(treatment); await db.SaveChangesAsync();
        var service = scope.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ImplantService>();
        var treatments = scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Treatments.ITreatmentService>();
        var record = await service.CreateAsync(database.PatientA, 35, appointmentId, treatment.Id, CancellationToken.None);
        await Assert.ThrowsAsync<TreatmentStateException>(() => treatments.TransitionAsync(treatment.Id, "complete", treatment.Version, CancellationToken.None));
        using var document = JsonDocument.Parse("""
            {"schemaVersion":1,"planning":{"imaging":"cbct","timing":"delayed","graft":"no"},
             "placement":{"date":"2026-10-21","brand":"Straumann","system":"BLX","connection":"RC","diameter":4.1,"length":10,"placementType":"delayed","stability":"good","component":"healing"},
             "healingVisits":[{"id":"00000000-0000-0000-0000-000000000001","date":"2026-12-21","healingType":"transmucosal","status":"normal","softTissue":"healthy","mobility":"none","pain":"none","boneLevel":"stable","nextPlan":"prosthetic","bleeding":"no","suppuration":"no","radiograph":"xray"}],
             "abutment":{"date":"2027-05-22","type":"stock","brand":"Straumann","connection":"BLX","height":4,"angle":0},
             "scan":{"date":"2027-05-22","scanType":"digital","coping":"scanbody","crownType":"zirconia","shadeSystem":"vita","shade":"A2","delivery":"lab","laboratory":"Lab"},
             "fixation":{"date":"2027-06-22","retention":"screw","seating":"final","occlusion":"satisfactory","stability":"stable"},
             "followupVisits":[{"id":"00000000-0000-0000-0000-000000000002","date":"2027-09-22","healing":"excellent","crown":"stable","occlusion":"satisfactory","hygiene":"good","outcome":"successful"}]}
            """);
        for (var step = 1; step <= 7; step++) record = await service.SaveAsync(record.Id, new(record.Version, document.RootElement, step), CancellationToken.None);
        Assert.Equal(7, record.CompletedStep);
        Assert.Equal(TreatmentStatus.Completed, (await db.Treatments.SingleAsync(x => x.Id == treatment.Id)).Status);
    }
    [Fact]
    public async Task ImplantDraftAndPrivateFilesPersistWithNoDuplicateFollowupAndCrossClinicReadsAreDenied()
    {
        using var scope = database.Scope(database.AdminA);
        var service = scope.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ImplantService>();
        var appointments = scope.ServiceProvider.GetRequiredService<DentalClinic.Application.Appointments.ICreateAppointment>();
        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(12));
        var appointmentId = await appointments.ExecuteAsync(new(database.PatientA, database.DoctorA,
            DentalClinic.Domain.Appointments.AppointmentType.FollowUp, new(date, new TimeOnly(9, 0), 30), "Implant test"), CancellationToken.None);
        var record = await service.CreateAsync(database.PatientA, 36, appointmentId, null, CancellationToken.None);
        var again = await service.CreateAsync(database.PatientA, 36, appointmentId, null, CancellationToken.None);
        Assert.Equal(record.Id, again.Id);
        var workflow = JsonSerializer.SerializeToElement(new
        {
            schemaVersion = 1,
            planning = new { imaging = "cbct", timing = "delayed", graft = "no" },
            placement = new { date = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), next = new { send = true, date = date.AddDays(7).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), time = "09:00", reason = "Healing review" } }
        });
        record = await service.SaveAsync(record.Id, new(record.Version, workflow, 1), CancellationToken.None);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = await db.Appointments.CountAsync(x => x.PatientId == database.PatientA && x.Notes != null && x.Notes.Contains("Implant #36"));
        Assert.Equal(1, count);
        record = await service.SaveAsync(record.Id, new(record.Version, workflow), CancellationToken.None);
        Assert.Equal(count, await db.Appointments.CountAsync(x => x.PatientId == database.PatientA && x.Notes != null && x.Notes.Contains("Implant #36")));
        var file = await service.AddFileAsync(record.Id, "placement", "label.pdf", "%PDF-1.7 test"u8.ToArray(), CancellationToken.None);
        Assert.Equal("label.pdf", (await service.FileAsync(record.Id, file.Id, CancellationToken.None)).FileName);
        using (var other = database.Scope(database.MemberB))
        {
            var otherDb = other.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Empty(await otherDb.ImplantRecords.IgnoreQueryFilters().Where(x => x.Id == record.Id).ToListAsync());
            Assert.Empty(await otherDb.ImplantAttachments.IgnoreQueryFilters().Where(x => x.Id == file.Id).ToListAsync());
            Assert.Equal(0, await otherDb.Database.ExecuteSqlInterpolatedAsync($"UPDATE implant_records SET \"WorkflowJson\"='{{}}'::jsonb WHERE \"Id\"={record.Id}"));
            Assert.Equal(0, await otherDb.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM implant_attachments WHERE \"Id\"={file.Id}"));
        }
        await using var app = await database.HttpAppAsync(); using var client = app.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/implants/{record.Id}/files/{file.Id}")).StatusCode);
        using var restored = database.Scope(database.AdminA);
        var restoredService = restored.ServiceProvider.GetRequiredService<DentalClinic.Infrastructure.Services.ImplantService>();
        await restoredService.DeleteFileAsync(record.Id, file.Id, CancellationToken.None);
        Assert.Empty(await restoredService.FilesAsync(record.Id, CancellationToken.None));
    }
    [Fact]
    public async Task RealLoginAndPatientApiRejectCrossClinicIdsAndForgedBrowserIdentity()
    {
        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        var cookie = await LoginAsync(client, database.MemberA);
        using var own = new HttpRequestMessage(HttpMethod.Get, $"/api/patients/{database.PatientA}");
        own.Headers.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(own)).StatusCode);
        using var other = new HttpRequestMessage(HttpMethod.Get, $"/api/patients/{database.PatientB}?userId={database.MemberB}&tenantId={database.TenantB}");
        other.Headers.Add("Cookie", cookie + $"; user_id={database.MemberB}; tenant_id={database.TenantB}");
        other.Headers.Add("X-Tenant-Id", database.TenantB.ToString());
        var response = await client.SendAsync(other);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("firstName", await response.Content.ReadAsStringAsync());
        using var anonymous = await client.GetAsync($"/api/patients/{database.PatientA}");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        using var session = new HttpRequestMessage(HttpMethod.Get, "/api/auth/session");
        session.Headers.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(session)).StatusCode);
    }

    [Fact]
    public async Task PublicBookingAndPrivateManagementLinkWorkWithRlsEnabled()
    {
        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("X-App-Request", "1");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/public/clinics/rls-a")).StatusCode);
        var payload = new PublicBookingRequest("rls-a", database.DoctorA, database.ServiceA,
            new DateTimeOffset(DateTime.UtcNow.Date.AddDays(3).AddHours(10), TimeSpan.Zero), 30, "New Patient", "01012345678", null, null, null, "rls-public-" + Guid.NewGuid().ToString("N"));
        var response = await client.PostAsJsonAsync("/api/public/clinics/rls-a/bookings", payload);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, body);
        var confirmation = JsonSerializer.Deserialize<PublicBookingConfirmationDto>(body, JsonSerializerOptions.Web)!;
        Assert.False(string.IsNullOrWhiteSpace(confirmation.ManagementToken));
        var path = "/api/public/bookings/confirmation/" + confirmation.BookingReference;
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path + "?manage=wrong-secret")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(path + "?manage=" + confirmation.ManagementToken)).StatusCode);
        var managementPath = "/api/public/bookings/manage/" + confirmation.ManagementToken;
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(managementPath + "/confirm", new { })).StatusCode);
        var rescheduled = await client.PostAsJsonAsync(managementPath + "/reschedule", new
        { startAt = new DateTimeOffset(DateTime.UtcNow.Date.AddDays(6).AddHours(11), TimeSpan.Zero) });
        Assert.True(rescheduled.StatusCode == HttpStatusCode.OK, await rescheduled.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/public/bookings/manage/incorrect-secret/cancel", new { reason = "Not authorized" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync(managementPath + "/cancel", new { reason = "Test cancellation" })).StatusCode);
        var repeated = await client.PostAsJsonAsync("/api/public/clinics/rls-a/bookings", payload);
        Assert.True(repeated.StatusCode == HttpStatusCode.Created, await repeated.Content.ReadAsStringAsync());
        var inquiry = await client.PostAsJsonAsync("/api/public/clinics/rls-a/inquiries", new PublicBookingInquiryRequest("Caller", "01012345678", null, "Please call"));
        Assert.True(inquiry.StatusCode == HttpStatusCode.Accepted, await inquiry.Content.ReadAsStringAsync());
        await using var owner = new NpgsqlConnection(database.OwnerConnection);
        await owner.OpenAsync();
        await using var alerts = new NpgsqlCommand("SELECT count(*) FROM notification_deliveries WHERE \"RelatedEntityType\"='BookingInquiry'", owner);
        Assert.True((long)(await alerts.ExecuteScalarAsync())! >= 1, "Public inquiry must still queue staff alerts under RLS.");
    }

    [Fact]
    public async Task PublicPhoneNumberCannotReadOrAttachAnExistingMedicalFile()
    {
        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("X-App-Request", "1");
        var payload = new PublicBookingRequest("rls-a", database.DoctorA, database.ServiceA,
            new DateTimeOffset(DateTime.UtcNow.Date.AddDays(4).AddHours(10), TimeSpan.Zero), 30,
            "Public Visitor", "01000000000", null, null, null, Guid.NewGuid().ToString("N"));
        var response = await client.PostAsJsonAsync("/api/public/clinics/rls-a/bookings", payload);
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, body);
        var confirmation = JsonSerializer.Deserialize<PublicBookingConfirmationDto>(body, JsonSerializerOptions.Web)!;
        Assert.Equal("Public Visitor", confirmation.PatientName);
        await using var owner = new NpgsqlConnection(database.OwnerConnection);
        await owner.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT \"PatientId\" FROM appointments WHERE \"BookingReference\"=@reference", owner);
        command.Parameters.AddWithValue("reference", confirmation.BookingReference);
        Assert.NotEqual(database.PatientA, (Guid)(await command.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task ClinicRegistrationConfirmationAndLoginWorkWithRestrictedDatabaseLogin()
    {
        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("X-App-Request", "1");
        var email = Guid.NewGuid().ToString("N") + "@example.invalid";
        var registered = await client.PostAsJsonAsync("/api/public/clinics/register", new
        { clinicName = "New Clinic", ownerName = "Owner", email, phone = "01022222222", address = "Street", city = "Cairo", country = "Egypt", password = "Password123!", confirmPassword = "Password123!", showcaseConsent = false });
        Assert.True(registered.StatusCode == HttpStatusCode.Accepted, await registered.Content.ReadAsStringAsync());
        Guid registrationId; string confirmationToken;
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            using var access = db.Access.Onboarding();
            var registration = await db.ClinicRegistrations.SingleAsync(x => x.Email == email);
            registrationId = registration.Id;
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var account = await users.FindByIdAsync(registration.IdentityUserId.ToString());
            confirmationToken = await users.GenerateEmailConfirmationTokenAsync(account!);
        }
        var confirmed = await client.PostAsJsonAsync("/api/public/clinics/confirm", new { id = registrationId, token = confirmationToken });
        Assert.True(confirmed.StatusCode == HttpStatusCode.OK, await confirmed.Content.ReadAsStringAsync());
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "Password123!" });
        Assert.True(login.StatusCode == HttpStatusCode.OK, await login.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ClinicAdminCanCreateBranchAndSwitchWithoutReadingOtherClinics()
    {
        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("X-App-Request", "1");
        var cookie = await LoginAsync(client, database.AdminA);
        using var create = new HttpRequestMessage(HttpMethod.Post, "/api/branches")
        { Content = JsonContent.Create(new { name = "Branch", code = "test-" + Guid.NewGuid().ToString("N")[..8], phone = "01033333333", address = "Street", city = "Cairo", country = "Egypt" }) };
        create.Headers.Add("Cookie", cookie);
        var result = await client.SendAsync(create);
        var body = await result.Content.ReadAsStringAsync();
        Assert.True(result.StatusCode == HttpStatusCode.Created, body);
        using var branchJson = JsonDocument.Parse(body);
        var branchId = branchJson.RootElement.GetProperty("id").GetGuid();
        using var backup = new HttpRequestMessage(HttpMethod.Post, "/api/backups/export-clinic")
        { Content = JsonContent.Create(new { modules = AllBackupModules, password = "BackupTestPassword123!" }) };
        backup.Headers.Add("Cookie", cookie);
        var exported = await client.SendAsync(backup);
        Assert.True(exported.StatusCode == HttpStatusCode.OK, exported.IsSuccessStatusCode ? "" : await exported.Content.ReadAsStringAsync());
        Assert.True((await exported.Content.ReadAsByteArrayAsync()).Length > 0);
        using var change = new HttpRequestMessage(HttpMethod.Post, "/api/auth/switch-clinic") { Content = JsonContent.Create(new { tenantId = branchId }) };
        change.Headers.Add("Cookie", cookie);
        var switched = await client.SendAsync(change);
        Assert.True(switched.StatusCode == HttpStatusCode.OK, await switched.Content.ReadAsStringAsync());
        var newCookie = switched.Headers.GetValues("Set-Cookie").Select(x => x.Split(';')[0])
            .Last(x => x.StartsWith("Planora.Clinic.Session=", StringComparison.Ordinal) && x != "Planora.Clinic.Session=");
        using var otherClinic = new HttpRequestMessage(HttpMethod.Get, $"/api/patients/{database.PatientB}");
        otherClinic.Headers.Add("Cookie", newCookie);
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(otherClinic)).StatusCode);
    }

    [Fact]
    public async Task ProfileEditorCannotStealMembershipOrReparentTheirClinic()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var membershipError = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE clinic_users SET \"IdentityUserId\"={database.IdentityA} WHERE \"Id\"={database.ColleagueA}"));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, membershipError.SqlState);
        var clinicError = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE tenants SET \"ParentClinicId\"={database.TenantB} WHERE \"Id\"={database.TenantA}"));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, clinicError.SqlState);
    }

    private static async Task<string> LoginAsync(HttpClient client, Guid member)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        { Content = JsonContent.Create(new { email = member + "@example.invalid", password = "Password123!" }) };
        request.Headers.Add("X-App-Request", "1");
        var response = await client.SendAsync(request);
        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return response.Headers.GetValues("Set-Cookie").Select(x => x.Split(';')[0])
            .Last(x => x.StartsWith("Planora.Clinic.Session=", StringComparison.Ordinal) && x != "Planora.Clinic.Session=");
    }

    [Fact]
    public async Task All91TablesAreForcedAndRuntimeCannotOwnOrBypassThem()
    {
        await DatabaseSecurityBootstrap.VerifyRuntimeAsync(database.Services);
        await using var connection = new NpgsqlConnection(database.OwnerConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity", connection);
        Assert.Equal(91L, await command.ExecuteScalarAsync());
        command.CommandText = "SELECT count(*) FROM pg_policies WHERE schemaname='public'";
        Assert.Equal(374L, await command.ExecuteScalarAsync());
    }

    [Fact]
    public async Task MissingIdentityDeniesAllPatientRows()
    {
        using var scope = database.Scope(null);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Empty(await db.Patients.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task DirectIdReadCannotCrossClinicEvenWithApplicationFilterRemoved()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.NotNull(await db.Patients.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == database.PatientA));
        Assert.Null(await db.Patients.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == database.PatientB));
    }

    [Fact]
    public async Task DirectSqlUpdateAndDeleteCannotTouchAnotherClinic()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(0, await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE patients SET \"FirstName\"='stolen' WHERE \"Id\"={database.PatientB}"));
        Assert.Equal(0, await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM patients WHERE \"Id\"={database.PatientB}"));
    }

    [Fact]
    public async Task WithCheckPreventsMovingOwnPatientIntoAnotherClinic()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE patients SET \"TenantId\"={database.TenantB} WHERE \"Id\"={database.PatientA}"));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    [Fact]
    public async Task WithCheckPreventsForeignClinicInsertWithoutSaveChangesHook()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO user_preferences (\"Id\",\"TenantId\",\"UserId\",\"Language\",\"Theme\",\"DateFormat\",\"TimeFormat\",\"StartOfWeek\",\"DefaultCalendarView\") VALUES ({Guid.NewGuid()},{database.TenantB},{database.MemberB},'en','Light','YYYY-MM-DD','24h',0,'timeGridWeek')"));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    [Fact]
    public async Task SameClinicSharesPatientsButNotPersonalPreferencesOrNotifications()
    {
        using var scope = database.Scope(database.ColleagueA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.NotNull(await db.Patients.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == database.PatientA));
        Assert.Empty(await db.UserPreferences.IgnoreQueryFilters().Where(x => x.UserId == database.MemberA).ToListAsync());
        Assert.Empty(await db.InAppNotifications.IgnoreQueryFilters().Where(x => x.UserId == database.MemberA).ToListAsync());
        Assert.Equal(0, await db.UserPreferences.IgnoreQueryFilters().Where(x => x.UserId == database.MemberA).ExecuteDeleteAsync());
    }

    [Fact]
    public async Task NormalMemberCannotGrantThemselvesAnotherRole()
    {
        using var scope = database.Scope(database.MemberA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var error = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO user_role_assignments (\"Id\",\"TenantId\",\"UserId\",\"RoleId\",\"AssignedAt\") VALUES ({Guid.NewGuid()},{database.TenantA},{database.MemberA},{database.RoleA},{DateTimeOffset.UtcNow})"));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    [Fact]
    public async Task ChangingTenantContextWithoutMatchingMembershipStillDeniesAccess()
    {
        using var scope = database.Scope(database.MemberA, database.TenantB);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Empty(await db.Patients.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task PooledConnectionDoesNotKeepPreviousUsersAccess()
    {
        using (var first = database.Scope(database.MemberA))
        {
            var db = first.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.NotEmpty(await db.Patients.IgnoreQueryFilters().ToListAsync());
        }
        using (var second = database.Scope(database.MemberB))
        {
            var db = second.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var rows = await db.Patients.IgnoreQueryFilters().ToListAsync();
            Assert.All(rows, row => Assert.Equal(database.TenantB, row.TenantId));
            Assert.NotEmpty(rows);
        }
        using var anonymous = database.Scope(null);
        Assert.Empty(await anonymous.ServiceProvider.GetRequiredService<ApplicationDbContext>().Patients.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task IdentityBootstrapCannotReadMedicalDataAndScopeRestoresAfterUse()
    {
        using var scope = database.Scope(null);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        using (db.Access.Authentication())
        {
            Assert.NotEmpty(await db.Users.IgnoreQueryFilters().ToListAsync());
            Assert.Empty(await db.Patients.IgnoreQueryFilters().ToListAsync());
        }
        Assert.Empty(await db.Users.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task WorkerCanSendNotificationsButCannotDeletePatientsOrReadPasswords()
    {
        await using var connection = new NpgsqlConnection(database.WorkerConnection);
        await connection.OpenAsync();
        await using var patients = new NpgsqlCommand("SELECT count(*) FROM patients", connection);
        Assert.True((long)(await patients.ExecuteScalarAsync())! >= 2);
        await using var accounts = new NpgsqlCommand("SELECT count(*) FROM \"AspNetUsers\"", connection);
        Assert.Equal(0L, await accounts.ExecuteScalarAsync());
        await using var delete = new NpgsqlCommand("DELETE FROM patients WHERE \"Id\"=@id", connection);
        delete.Parameters.AddWithValue("id", database.PatientB);
        Assert.Equal(0, await delete.ExecuteNonQueryAsync());
        await using var notification = new NpgsqlCommand("""
            INSERT INTO in_app_notifications ("Id","TenantId","UserId","Title","Body","Type","IsRead","CreatedAt")
            VALUES (@id,@tenant,@user,'Worker test','Notification delivery','General',FALSE,now())
            """, connection);
        notification.Parameters.AddWithValue("id", Guid.NewGuid());
        notification.Parameters.AddWithValue("tenant", database.TenantB);
        notification.Parameters.AddWithValue("user", database.MemberB);
        Assert.Equal(1, await notification.ExecuteNonQueryAsync());
    }

    [Fact]
    public async Task SameConnectionClearsTemporaryIdentityCapabilityAfterTransaction()
    {
        using var scope = database.Scope(null);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.OpenConnectionAsync();
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            using (db.Access.Authentication()) Assert.NotEmpty(await db.Users.IgnoreQueryFilters().ToListAsync());
            Assert.Empty(await db.Users.IgnoreQueryFilters().ToListAsync());
            await transaction.CommitAsync();
        }
        Assert.Empty(await db.Users.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(await db.Patients.IgnoreQueryFilters().ToListAsync());
    }
}

public sealed class RowSecurityDatabase : IAsyncLifetime
{
    private PostgreSqlContainer? postgres;
    private string adminConnection = "";
    private readonly string databaseName = "rls_test_" + Guid.NewGuid().ToString("N");
    private readonly string loginName = "rls_login_" + Guid.NewGuid().ToString("N");
    public string OwnerConnection { get; private set; } = "";
    public string RuntimeConnection { get; private set; } = "";
    public string WorkerConnection { get; private set; } = "";
    public ServiceProvider Services { get; private set; } = null!;
    public Guid TenantA { get; private set; }
    public Guid TenantB { get; private set; }
    public Guid MemberA { get; } = Guid.NewGuid();
    public Guid ColleagueA { get; } = Guid.NewGuid();
    public Guid MemberB { get; } = Guid.NewGuid();
    public Guid AdminA { get; } = Guid.NewGuid();
    public Guid IdentityA => identities[MemberA];
    public Guid PatientA { get; private set; }
    public Guid PatientB { get; private set; }
    public Guid RoleA { get; private set; }
    public Guid DoctorA { get; private set; }
    public Guid ServiceA { get; private set; }
    private readonly Dictionary<Guid, Guid> identities = [];

    public async Task InitializeAsync()
    {
        adminConnection = Environment.GetEnvironmentVariable("RLS_TEST_POSTGRES") ?? "";
        if (adminConnection.Length == 0)
        {
            postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await postgres.StartAsync();
            adminConnection = postgres.GetConnectionString();
        }
        OwnerConnection = new NpgsqlConnectionStringBuilder(adminConnection) { Database = databaseName, Pooling = false }.ConnectionString;
        var current = new CurrentTenant();
        await using (var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(OwnerConnection)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)).Options, current))
        {
            await db.Database.MigrateAsync();
            var now = DateTimeOffset.UtcNow.AddMinutes(-1);
            var a = new Tenant("Clinic A", "rls-a", "01000000001", "a@example.invalid", "Street", "Cairo", "Egypt", "UTC", "EGP", now, subscriptionMonths: 12);
            var b = new Tenant("Clinic B", "rls-b", "01000000002", "b@example.invalid", "Street", "Cairo", "Egypt", "UTC", "EGP", now, subscriptionMonths: 12);
            TenantA = a.Id; TenantB = b.Id;
            db.Tenants.AddRange(a, b);
            await db.SaveChangesAsync();
            foreach (var (member, tenant) in new[] { (MemberA, TenantA), (ColleagueA, TenantA), (MemberB, TenantB), (AdminA, TenantA) })
            {
                current.Set(tenant);
                var identity = Guid.NewGuid(); identities.Add(member, identity);
                var account = new ApplicationUser { Id = identity, UserName = member + "@example.invalid", NormalizedUserName = (member + "@example.invalid").ToUpperInvariant(), Email = member + "@example.invalid", NormalizedEmail = (member + "@example.invalid").ToUpperInvariant(), EmailConfirmed = true, SecurityStamp = Guid.NewGuid().ToString("N") };
                account.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(account, "Password123!");
                db.Users.Add(account);
                db.ClinicUsers.Add(new ClinicUser(member, tenant, "Member", null, UserStatus.Active, now, identity));
                await db.SaveChangesAsync();
            }
            current.Set(TenantA);
            var patientA = Patient(TenantA, "AAA-000001"); PatientA = patientA.Id;
            db.Patients.Add(patientA);
            db.UserPreferences.Add(new UserPreference(TenantA, MemberA));
            db.InAppNotifications.Add(new InAppNotification(TenantA, MemberA, "Private", "Personal content", "General", null, null, now));
            var role = new TenantRole(TenantA, "Staff", "Limited", false, now); RoleA = role.Id;
            db.TenantRoles.Add(role);
            db.UserRoleAssignments.Add(new UserRoleAssignment(TenantA, MemberA, role.Id, now));
            db.UserRoleAssignments.Add(new UserRoleAssignment(TenantA, ColleagueA, role.Id, now));
            db.RolePermissions.Add(new RolePermissionGrant(TenantA, role.Id, Permissions.PatientsView));
            db.RolePermissions.Add(new RolePermissionGrant(TenantA, role.Id, Permissions.AppointmentsView));
            db.RolePermissions.Add(new RolePermissionGrant(TenantA, role.Id, Permissions.UsersEdit));
            db.RolePermissions.Add(new RolePermissionGrant(TenantA, role.Id, Permissions.SettingsClinicProfile));
            var adminRole = new TenantRole(TenantA, SystemRoleDefinitions.ClinicAdmin, "Clinic administrator", true, now);
            db.TenantRoles.Add(adminRole);
            db.UserRoleAssignments.Add(new UserRoleAssignment(TenantA, AdminA, adminRole.Id, now));
            foreach (var permission in Permissions.All) db.RolePermissions.Add(new RolePermissionGrant(TenantA, adminRole.Id, permission));
            var doctor = new DoctorProfile(TenantA, MemberA, "Dentist", "RLS-TEST", null, 30, now); DoctorA = doctor.Id;
            var service = new TreatmentCatalogItem(TenantA, TreatmentType.RootCanal, "Test treatment", "RLS", null, 100, now); ServiceA = service.Id;
            db.DoctorProfiles.Add(doctor);
            foreach (var day in Enum.GetValues<DayOfWeek>())
                db.DoctorSchedules.Add(new DoctorSchedule(TenantA, doctor.Id, day, new TimeOnly(8, 0), new TimeOnly(18, 0), 30, [], now));
            db.TreatmentCatalogItems.Add(service);
            db.TenantConfigurations.Add(TenantConfiguration.CreateForTenant(TenantA, "en", "UTC", "EGP", publicBookingEnabled: true));
            await db.SaveChangesAsync();
            current.Set(TenantB);
            var patientB = Patient(TenantB, "BBB-000001"); PatientB = patientB.Id;
            db.Patients.Add(patientB);
            await db.SaveChangesAsync();
        }
        var password = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        await using (var connection = new NpgsqlConnection(OwnerConnection))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE ROLE {loginName} LOGIN PASSWORD '{password}' NOSUPERUSER NOBYPASSRLS; GRANT meddentist_runtime TO {loginName}; CREATE ROLE {loginName}_jobs LOGIN PASSWORD '{password}' NOSUPERUSER NOBYPASSRLS; GRANT meddentist_runtime, meddentist_worker TO {loginName}_jobs", connection);
            await command.ExecuteNonQueryAsync();
        }
        RuntimeConnection = new NpgsqlConnectionStringBuilder(OwnerConnection) { Username = loginName, Password = password, Pooling = true, MaxPoolSize = 1 }.ConnectionString;
        WorkerConnection = new NpgsqlConnectionStringBuilder(RuntimeConnection) { Username = loginName + "_jobs", Pooling = false }.ConnectionString;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Postgres"] = RuntimeConnection, ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false" }).Build();
        var services = new ServiceCollection();
        services.AddLogging(); services.AddApplication(); services.AddInfrastructure(config);
        Services = services.BuildServiceProvider();
    }

    public IServiceScope Scope(Guid? member, Guid? forcedTenant = null)
    {
        var scope = Services.CreateScope();
        var context = new DefaultHttpContext();
        if (member.HasValue)
        {
            var tenant = forcedTenant ?? (member == MemberB ? TenantB : TenantA);
            scope.ServiceProvider.GetRequiredService<CurrentTenant>().Set(tenant);
            context.User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim("sub", member.Value.ToString()),
                new Claim(VerifiedSessionEvents.IdentityClaim, identities[member.Value].ToString()),
                new Claim(AuthConstants.TenantIdClaim, tenant.ToString())], "verified-test-session"));
        }
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = context;
        return scope;
    }

    public async Task<WebApplication> HttpAppAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Postgres"] = RuntimeConnection, ["ConnectionStrings:Redis"] = "localhost:6379,abortConnect=false",
          ["Onboarding:PublicAppUrl"] = "http://localhost", ["Onboarding:ClinicAppUrl"] = "http://localhost" });
        builder.Services.AddApplication(); builder.Services.AddInfrastructure(builder.Configuration);
        builder.Services.RemoveAll<IDistributedCache>(); builder.Services.AddDistributedMemoryCache();
        builder.Services.AddApiAuthentication(builder.Configuration); builder.Services.AddApiAuthorization();
        builder.Services.AddProblemDetails(); builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
        var app = builder.Build();
        app.UseExceptionHandler(); app.UseRouting(); app.UseMiddleware<SessionSecurityMiddleware>();
        app.UseAuthentication(); app.UseMiddleware<TenantResolutionMiddleware>(); app.UseAuthorization();
        app.MapClinicalWorkflowEndpoints(); app.MapImplantEndpoints(); app.MapIdentityEndpoints(); app.MapPatientEndpoints(); app.MapPublicBookingEndpoints(); app.MapOnboardingEndpoints(); app.MapBranchEndpoints(); app.MapBackupEndpoints();
        await app.StartAsync();
        return app;
    }

    private static Patient Patient(Guid tenant, string number) => new(tenant, number, "Patient", null, "Test", PatientGender.NotSpecified,
        new DateOnly(1990, 1, 1), "01000000000", null, null, null, null, null, null, null, null, null, null, null, null, DateTimeOffset.UtcNow);

    public async Task DisposeAsync()
    {
        if (Services is not null) await Services.DisposeAsync();
        if (RuntimeConnection.Length > 0) NpgsqlConnection.ClearPool(new NpgsqlConnection(RuntimeConnection));
        if (adminConnection.Length > 0)
        {
            await using var connection = new NpgsqlConnection(adminConnection);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS {databaseName} WITH (FORCE); DROP ROLE IF EXISTS {loginName}; DROP ROLE IF EXISTS {loginName}_jobs", connection);
            await command.ExecuteNonQueryAsync();
        }
        if (postgres is not null) await postgres.DisposeAsync();
    }
}
