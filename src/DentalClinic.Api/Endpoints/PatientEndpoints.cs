using DentalClinic.Application.Identity;
using DentalClinic.Application.Patients;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Contracts.Patients;
using DentalClinic.Domain.Patients;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class PatientEndpoints
{
    public static IEndpointRouteBuilder MapPatientEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var patients = endpoints.MapGroup("/api/patients")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy);

        patients.MapGet("/", SearchAsync).RequireAuthorization(Permissions.PatientsView);
        patients.MapGet("/{id:guid}", GetAsync).RequireAuthorization(Permissions.PatientsView);
        patients.MapPost("/", CreateAsync).RequireAuthorization(Permissions.PatientsCreate);
        patients.MapPut("/{id:guid}", UpdateAsync).RequireAuthorization(Permissions.PatientsEdit);
        patients.MapPost("/{id:guid}/archive", ArchiveAsync).RequireAuthorization(Permissions.PatientsArchive);

        patients.MapPut("/{id:guid}/medical-notes", UpdateMedicalNotesAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        MapMedicalText(patients, "allergies", MedicalRecordKind.Allergy);
        MapMedicalText(patients, "conditions", MedicalRecordKind.Condition);
        patients.MapPost("/{id:guid}/medications", AddMedicationAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapPut("/{id:guid}/medications/{itemId:guid}", UpdateMedicationAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapDelete("/{id:guid}/medications/{itemId:guid}", RemoveMedicationAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapPost("/{id:guid}/surgeries", AddSurgeryAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapPut("/{id:guid}/surgeries/{itemId:guid}", UpdateSurgeryAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapDelete("/{id:guid}/surgeries/{itemId:guid}", RemoveSurgeryAsync)
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        return endpoints;
    }

    private static void MapMedicalText(RouteGroupBuilder patients, string segment, MedicalRecordKind kind)
    {
        patients.MapPost($"/{{id:guid}}/{segment}", (Guid id, MedicalTextRequest request,
                IPatientMedicalCommands service, CancellationToken token) => AddMedicalTextAsync(id, request, kind, service, token))
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapPut($"/{{id:guid}}/{segment}/{{itemId:guid}}", (Guid id, Guid itemId, MedicalTextRequest request,
                IPatientMedicalCommands service, CancellationToken token) => UpdateMedicalTextAsync(id, itemId, request, kind, service, token))
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
        patients.MapDelete($"/{{id:guid}}/{segment}/{{itemId:guid}}", (Guid id, Guid itemId,
                IPatientMedicalCommands service, CancellationToken token) => RemoveMedicalTextAsync(id, itemId, kind, service, token))
            .RequireAuthorization(Permissions.PatientsEditMedicalHistory);
    }

    private static Task<PagedResult<PatientListItem>> SearchAsync(
        IPatientQueries service, string? search, PatientStatus? status, PatientGender? gender,
        DateOnly? registeredFrom, DateOnly? registeredTo, PatientSortField sortBy = PatientSortField.CreatedAt,
        bool descending = true, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default) =>
        service.SearchAsync(new PatientSearchQuery(search, status, gender, registeredFrom, registeredTo,
            sortBy, descending, page, pageSize), cancellationToken);

    private static async Task<IResult> GetAsync(Guid id, IPatientQueries service, CancellationToken cancellationToken) =>
        await service.GetAsync(id, cancellationToken) is { } patient ? Results.Ok(patient) : Results.NotFound();

    private static async Task<IResult> CreateAsync(
        PatientProfileRequest request, IPatientCommands service, CancellationToken cancellationToken)
    {
        var id = await service.CreateAsync(new CreatePatientCommand(ToInput(request)), cancellationToken);
        return Results.Created($"/api/patients/{id:D}", new { id });
    }

    private static async Task<IResult> UpdateAsync(
        Guid id, PatientProfileRequest request, IPatientCommands service, CancellationToken cancellationToken) =>
        await service.UpdateAsync(new UpdatePatientCommand(id, ToInput(request)), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> ArchiveAsync(Guid id, IPatientCommands service, CancellationToken cancellationToken) =>
        await service.ArchiveAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> UpdateMedicalNotesAsync(
        Guid id, MedicalNotesRequest request, IPatientMedicalCommands service, CancellationToken cancellationToken) =>
        await service.UpdateMedicalNotesAsync(new UpdateMedicalNotesCommand(id, request.MedicalNotes), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> AddMedicalTextAsync(
        Guid id, MedicalTextRequest request, MedicalRecordKind kind,
        IPatientMedicalCommands service, CancellationToken cancellationToken)
    {
        var command = new MedicalTextCommand(request.Name, request.Notes);
        var itemId = kind == MedicalRecordKind.Allergy
            ? await service.AddAllergyAsync(id, command, cancellationToken)
            : await service.AddConditionAsync(id, command, cancellationToken);
        return itemId is { } created ? Results.Created($"/api/patients/{id:D}", new { id = created }) : Results.NotFound();
    }

    private static async Task<IResult> UpdateMedicalTextAsync(
        Guid id, Guid itemId, MedicalTextRequest request, MedicalRecordKind kind,
        IPatientMedicalCommands service, CancellationToken cancellationToken)
    {
        var command = new MedicalTextCommand(request.Name, request.Notes);
        var updated = kind == MedicalRecordKind.Allergy
            ? await service.UpdateAllergyAsync(id, itemId, command, cancellationToken)
            : await service.UpdateConditionAsync(id, itemId, command, cancellationToken);
        return updated ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> RemoveMedicalTextAsync(
        Guid id, Guid itemId, MedicalRecordKind kind,
        IPatientMedicalCommands service, CancellationToken cancellationToken)
    {
        var removed = kind == MedicalRecordKind.Allergy
            ? await service.RemoveAllergyAsync(id, itemId, cancellationToken)
            : await service.RemoveConditionAsync(id, itemId, cancellationToken);
        return removed ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> AddMedicationAsync(
        Guid id, MedicationRequest request, IPatientMedicalCommands service, CancellationToken cancellationToken)
    {
        var itemId = await service.AddMedicationAsync(id,
            new MedicationCommand(request.Name, request.Dosage, request.Notes), cancellationToken);
        return itemId is { } created ? Results.Created($"/api/patients/{id:D}", new { id = created }) : Results.NotFound();
    }

    private static async Task<IResult> UpdateMedicationAsync(
        Guid id, Guid itemId, MedicationRequest request, IPatientMedicalCommands service, CancellationToken cancellationToken) =>
        await service.UpdateMedicationAsync(id, itemId,
            new MedicationCommand(request.Name, request.Dosage, request.Notes), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> RemoveMedicationAsync(
        Guid id, Guid itemId, IPatientMedicalCommands service, CancellationToken cancellationToken) =>
        await service.RemoveMedicationAsync(id, itemId, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> AddSurgeryAsync(
        Guid id, SurgeryRequest request, IPatientMedicalCommands service, CancellationToken cancellationToken)
    {
        var itemId = await service.AddSurgeryAsync(id,
            new SurgeryCommand(request.Procedure, request.ProcedureDate, request.Notes), cancellationToken);
        return itemId is { } created ? Results.Created($"/api/patients/{id:D}", new { id = created }) : Results.NotFound();
    }

    private static async Task<IResult> UpdateSurgeryAsync(
        Guid id, Guid itemId, SurgeryRequest request, IPatientMedicalCommands service, CancellationToken cancellationToken) =>
        await service.UpdateSurgeryAsync(id, itemId,
            new SurgeryCommand(request.Procedure, request.ProcedureDate, request.Notes), cancellationToken)
            ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> RemoveSurgeryAsync(
        Guid id, Guid itemId, IPatientMedicalCommands service, CancellationToken cancellationToken) =>
        await service.RemoveSurgeryAsync(id, itemId, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static PatientProfileInput ToInput(PatientProfileRequest request) => new(
        request.FirstName, request.MiddleName, request.LastName, (PatientGender)request.Gender, request.DateOfBirth,
        request.Phone, request.AlternatePhone, request.Email, request.Address, request.City, request.Country,
        request.EmergencyContactName, request.EmergencyContactPhone, request.Nationality, request.Occupation,
        request.MaritalStatus is null ? null : (MaritalStatus)request.MaritalStatus, request.Notes);

    private enum MedicalRecordKind { Allergy, Condition }
}
