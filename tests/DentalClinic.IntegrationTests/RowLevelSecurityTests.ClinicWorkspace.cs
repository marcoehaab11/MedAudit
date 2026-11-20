using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using DentalClinic.Application.Finance;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Finance;
using DentalClinic.Domain.Prescriptions;
using DentalClinic.Domain.Patients;
using DentalClinic.Domain.Treatments;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DentalClinic.IntegrationTests;

public sealed partial class RowLevelSecurityTests
{
    [Fact]
    public async Task ClinicWorkspaceReadsAttendedVisitsAndIssuedPrescriptionsAndIsolatesRooms()
    {
        var now = DateTimeOffset.UtcNow;
        var firstDay = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(4);
        using var scope = database.Scope(database.AdminA);
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var room = new ClinicRoom(database.TenantA, "Workspace test room");
        var attended = new Appointment(database.TenantA, database.PatientA, database.DoctorA,
            AppointmentType.FollowUp, firstDay.AddDays(2).AddHours(10), 30, null, database.AdminA, now, roomId: room.Id);
        attended.Confirm(now);
        attended.CheckIn(firstDay.AddDays(2).AddHours(10));
        var noShow = new Appointment(database.TenantA, database.PatientA, database.DoctorA,
            AppointmentType.FollowUp, firstDay.AddDays(3).AddHours(10), 30, null, database.AdminA, now, roomId: room.Id);
        noShow.Confirm(now);
        noShow.MarkNoShow(firstDay.AddDays(3).AddHours(10));
        var draft = new Prescription(database.TenantA, database.PatientA, database.DoctorA, null, null, null,
            "RX-WORKSPACE-DRAFT", null, database.AdminA, now);
        var issued = new Prescription(database.TenantA, database.PatientA, database.DoctorA, null, null, null,
            "RX-WORKSPACE-ISSUED", null, database.AdminA, now);
        issued.AddItem(null, "Archived fixture medication", null, "Saved strength", null, "Saved dose",
            "Saved frequency", "Saved duration", null, "Saved instructions", null, 1, issued.Version, now);
        db.AddRange(room, attended, noShow, draft, issued);
        await db.SaveChangesAsync();
        issued.Issue(database.AdminA, "workspace-reference", issued.Version, firstDay);
        await db.SaveChangesAsync();

        await using var app = await database.HttpAppAsync();
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("Cookie", await LoginAsync(client, database.AdminA, database.TenantA));

        var month = firstDay.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var directory = await client.GetFromJsonAsync<JsonElement>($"/api/doctors/directory?month={month}");
        var doctor = Assert.Single(directory.GetProperty("items").EnumerateArray(), x => x.GetProperty("id").GetGuid() == database.DoctorA);
        Assert.Equal(1, doctor.GetProperty("totalVisits").GetInt32());
        Assert.Equal(1, doctor.GetProperty("followUps").GetInt32());

        var rooms = await client.GetFromJsonAsync<JsonElement>("/api/appointments/rooms");
        Assert.Contains(rooms.EnumerateArray(), x => x.GetProperty("id").GetGuid() == room.Id);
        using var foreignScope = database.Scope(database.MemberB);
        var foreignDb = foreignScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await foreignDb.ClinicRooms.IgnoreQueryFilters().AnyAsync(x => x.Id == room.Id));

        var visitDate = attended.StartAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var schedule = await client.GetFromJsonAsync<JsonElement>($"/api/appointments?from={visitDate}&to={visitDate}");
        var match = Assert.Single(schedule.GetProperty("page").GetProperty("items").EnumerateArray(),
            x => x.GetProperty("id").GetGuid() == attended.Id);
        Assert.Equal(room.Id, match.GetProperty("roomId").GetGuid());

        var localDate = firstDay.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var prescriptions = await client.GetFromJsonAsync<JsonElement>($"/api/prescriptions?issuedOnly=true&search=AAA-000001&from={localDate}&to={localDate}");
        var archived = Assert.Single(prescriptions.GetProperty("items").EnumerateArray());
        Assert.Equal(issued.Id, archived.GetProperty("id").GetGuid());
        Assert.Equal("AAA-000001", archived.GetProperty("patientNumber").GetString());
        var record = await client.GetFromJsonAsync<JsonElement>($"/api/prescriptions/{issued.Id}");
        Assert.Equal("Saved instructions", Assert.Single(record.GetProperty("items").EnumerateArray()).GetProperty("instructions").GetString());
    }

    [Fact]
    public async Task PaidCommissionPostsIntoExistingLedgerOnceAcrossPartialPayments()
    {
        using var scope = database.Scope(database.AdminA);
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<ApplicationDbContext>();
        var now = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        if (!await db.FinancialCategories.AnyAsync(x => x.Code == "TREATMENT_REVENUE"))
            db.FinancialCategories.Add(new(database.TenantA, "Treatment revenue", "TREATMENT_REVENUE", FinancialCategoryType.Revenue, null, now));
        var patient = new Patient(database.TenantA, "PAY-000001", "Payment", null, "Commission",
            PatientGender.NotSpecified, new DateOnly(1990, 1, 1), "01000000000",
            null, null, null, null, null, null, null, null, null, null, null, null, now);
        var doctor = new DoctorProfile(database.TenantA, database.AdminA, "Dentist", "COMMISSION-QA", null, 30, now);
        var rule = new DoctorCompensation(database.TenantA, doctor.Id, CompensationType.Percentage,
            null, 30m, today, null, now, CommissionBasis.AmountPaid);
        var treatment = new Treatment(database.TenantA, patient.Id, doctor.Id, null,
            null, null, database.ServiceA, null, TreatmentType.Filling, "Payment commission fixture", [21],
            100m, null, now);
        treatment.Start(treatment.Version, now);
        treatment.Complete(treatment.Version, now);
        db.AddRange(patient, doctor, rule, treatment);
        await db.SaveChangesAsync();

        var creator = services.GetRequiredService<ITreatmentRevenueCreator>();
        await creator.EnsureForCompletedTreatmentAsync(treatment.Id, CancellationToken.None);
        await db.SaveChangesAsync();
        Assert.Empty(await db.DoctorCompensationCosts.Where(x => x.TreatmentId == treatment.Id).ToArrayAsync());
        var revenue = await db.Revenues.SingleAsync(x => x.TreatmentId == treatment.Id);
        var payments = services.GetRequiredService<IPaymentService>();
        foreach (var amount in new decimal[] { 40, 60 })
            await payments.CreateAsync(new(patient.Id, revenue.Id, treatment.Id, amount, PaymentMethod.Cash,
                null, null, today, new TimeOnly(10, 0)), CancellationToken.None);
        var costs = await db.DoctorCompensationCosts.Where(x => x.TreatmentId == treatment.Id).ToArrayAsync();
        Assert.Equal(30m, costs.Sum(x => x.Amount));
        Assert.Equal(2, costs.Select(x => x.PaymentId).Distinct().Count());
        var balances = await services.GetRequiredService<IFinanceStore>().DoctorDuesAsync([doctor.Id], CancellationToken.None);
        Assert.Equal(30m, balances[doctor.Id].Total);
        Assert.Equal(1, balances[doctor.Id].TreatmentCount);
    }
}
