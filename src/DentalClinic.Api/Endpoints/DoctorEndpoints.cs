using DentalClinic.Application.Doctors;
using DentalClinic.Application.Identity;
using DentalClinic.Application.Tenants.Models;
using DentalClinic.Contracts.Doctors;
using DentalClinic.Domain.Doctors;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class DoctorEndpoints
{
    public static IEndpointRouteBuilder MapDoctorEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var doctors = endpoints.MapGroup("/api/doctors").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        doctors.MapGet("/", SearchAsync).RequireAuthorization(Permissions.DoctorsView);
        doctors.MapGet("/candidates", GetCandidatesAsync).RequireAuthorization(Permissions.DoctorsCreate);
        doctors.MapGet("/{id:guid}", GetAsync).RequireAuthorization(Permissions.DoctorsView);
        doctors.MapPost("/", CreateAsync).RequireAuthorization(Permissions.DoctorsCreate);
        doctors.MapPut("/{id:guid}", UpdateAsync).RequireAuthorization(Permissions.DoctorsEdit);
        doctors.MapPost("/{id:guid}/activate", ActivateAsync).RequireAuthorization(Permissions.DoctorsEdit);
        doctors.MapPost("/{id:guid}/deactivate", DeactivateAsync).RequireAuthorization(Permissions.DoctorsEdit);
        doctors.MapPost("/{id:guid}/archive", ArchiveAsync).RequireAuthorization(Permissions.DoctorsArchive);
        doctors.MapGet("/{id:guid}/schedule", GetScheduleAsync).RequireAuthorization(Permissions.DoctorsView);
        doctors.MapPut("/{id:guid}/schedule", SetScheduleAsync).RequireAuthorization(Permissions.DoctorsManageSchedule);
        doctors.MapGet("/{id:guid}/compensation", GetCompensationAsync)
            .RequireAuthorization(Permissions.DoctorsManageCompensation);
        doctors.MapPost("/{id:guid}/compensation", CreateCompensationAsync)
            .RequireAuthorization(Permissions.DoctorsManageCompensation);
        doctors.MapPost("/{id:guid}/compensation/change", UpdateCompensationAsync)
            .RequireAuthorization(Permissions.DoctorsManageCompensation);
        return endpoints;
    }

    private static Task<PagedResult<DoctorListItem>> SearchAsync(IDoctorProfileQueries service, string? search,
        DoctorProfileStatus? status, string? specialization, int page = 1, int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        service.SearchAsync(new DoctorSearchQuery(search, status, specialization, page, pageSize), cancellationToken);
    private static Task<IReadOnlyCollection<DoctorCandidate>> GetCandidatesAsync(
        IDoctorProfileQueries service, CancellationToken cancellationToken) => service.GetCandidatesAsync(cancellationToken);
    private static async Task<IResult> GetAsync(Guid id, IDoctorProfileQueries service, CancellationToken cancellationToken) =>
        await service.GetAsync(id, cancellationToken) is { } result ? Results.Ok(result) : Results.NotFound();
    private static async Task<IResult> CreateAsync(DoctorProfileRequest request, IDoctorProfileCommands service,
        CancellationToken cancellationToken)
    {
        var id = await service.CreateAsync(new CreateDoctorProfileCommand(request.ClinicUserId, ToInput(request)), cancellationToken);
        return Results.Created($"/api/doctors/{id:D}", new { id });
    }
    private static async Task<IResult> UpdateAsync(Guid id, UpdateDoctorProfileRequest request,
        IDoctorProfileCommands service, CancellationToken cancellationToken) =>
        await service.UpdateAsync(new UpdateDoctorProfileCommand(id, ToInput(request)), cancellationToken)
            ? Results.NoContent() : Results.NotFound();
    private static Task<IResult> ActivateAsync(Guid id, IDoctorProfileCommands service, CancellationToken token) =>
        SetActiveAsync(id, true, service, token);
    private static Task<IResult> DeactivateAsync(Guid id, IDoctorProfileCommands service, CancellationToken token) =>
        SetActiveAsync(id, false, service, token);
    private static async Task<IResult> SetActiveAsync(Guid id, bool active, IDoctorProfileCommands service,
        CancellationToken cancellationToken) => await service.SetActiveAsync(id, active, cancellationToken)
        ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> ArchiveAsync(Guid id, IDoctorProfileCommands service, CancellationToken token) =>
        await service.ArchiveAsync(id, token) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> GetScheduleAsync(Guid id, IDoctorScheduleService service,
        CancellationToken token) => await service.GetAsync(id, token) is { } result ? Results.Ok(result) : Results.NotFound();
    private static async Task<IResult> SetScheduleAsync(Guid id, DoctorScheduleRequest request,
        IDoctorScheduleService service, CancellationToken token) =>
        await service.SetAsync(id, request.Periods.Select(x => new SchedulePeriodInput((DayOfWeek)x.DayOfWeek,
            x.StartTime, x.EndTime, x.SlotDurationMinutes,
            x.Breaks.Select(b => new ScheduleBreakInput(b.StartTime, b.EndTime)).ToArray())).ToArray(), token)
            ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> GetCompensationAsync(Guid id, IDoctorCompensationService service,
        CancellationToken token) => await service.GetHistoryAsync(id, token) is { } result ? Results.Ok(result) : Results.NotFound();
    private static async Task<IResult> CreateCompensationAsync(Guid id, DoctorCompensationRequest request,
        IDoctorCompensationService service, CancellationToken token)
    {
        var result = await service.CreateAsync(new CreateDoctorCompensationCommand(id, ToInput(request)), token);
        return result is { } created ? Results.Created($"/api/doctors/{id:D}/compensation", new { id = created }) : Results.NotFound();
    }
    private static async Task<IResult> UpdateCompensationAsync(Guid id, DoctorCompensationRequest request,
        IDoctorCompensationService service, CancellationToken token)
    {
        var result = await service.UpdateAsync(new UpdateDoctorCompensationCommand(id, ToInput(request)), token);
        return result is { } created ? Results.Created($"/api/doctors/{id:D}/compensation", new { id = created }) : Results.NotFound();
    }
    private static DoctorProfileInput ToInput(DoctorProfileRequest x) =>
        new(x.Specialization, x.LicenseNumber, x.Bio, x.ConsultationDurationMinutes);
    private static DoctorProfileInput ToInput(UpdateDoctorProfileRequest x) =>
        new(x.Specialization, x.LicenseNumber, x.Bio, x.ConsultationDurationMinutes);
    private static DoctorCompensationInput ToInput(DoctorCompensationRequest x) =>
        new((CompensationType)x.CompensationType, x.FixedAmount, x.Percentage, x.EffectiveFrom, x.EffectiveTo);
}
