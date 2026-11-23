using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using DentalClinic.Application.Appointments;
using DentalClinic.Application.Identity;
using DentalClinic.Contracts.Appointments;
using DentalClinic.Domain.Appointments;
using DentalClinic.Infrastructure.Identity;

namespace DentalClinic.Api.Endpoints;

internal static class AppointmentEndpoints
{
    public static IEndpointRouteBuilder MapAppointmentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var appointments = endpoints.MapGroup("/api/appointments").RequireAuthorization(AuthConstants.TenantMemberPolicy);
        appointments.MapGet("/", SearchAsync).RequireAuthorization(Permissions.AppointmentsView);
        appointments.MapGet("/rooms", GetRoomsAsync);
        appointments.MapPost("/rooms", CreateRoomAsync).RequireAuthorization(Permissions.SettingsAppointments);
        appointments.MapGet("/availability", AvailabilityAsync).RequireAuthorization(Permissions.AppointmentsView);
        appointments.MapGet("/{id:guid}", GetAsync).RequireAuthorization(Permissions.AppointmentsView);
        appointments.MapPost("/", CreateAsync).RequireAuthorization(Permissions.AppointmentsCreate);
        appointments.MapPut("/{id:guid}/room", (Guid id, AssignRoomRequest request, IAppointmentLifecycle service, CancellationToken token) =>
            ResultAsync(service.AssignRoomAsync(id, request.RoomId, token))).RequireAuthorization(Permissions.AppointmentsEdit);
        appointments.MapPut("/{id:guid}/reschedule", RescheduleAsync).RequireAuthorization(Permissions.AppointmentsEdit);
        appointments.MapPost("/{id:guid}/confirm", ConfirmAsync).RequireAuthorization(Permissions.AppointmentsEdit);
        appointments.MapPost("/{id:guid}/cancel", CancelAsync).RequireAuthorization(Permissions.AppointmentsCancel);
        appointments.MapPost("/{id:guid}/check-in", CheckInAsync).RequireAuthorization(Permissions.AppointmentsCheckIn);
        appointments.MapPost("/{id:guid}/start", StartAsync).RequireAuthorization(Permissions.AppointmentsStart);
        appointments.MapPost("/{id:guid}/complete", CompleteAsync).RequireAuthorization(Permissions.AppointmentsComplete);
        appointments.MapPost("/{id:guid}/no-show", NoShowAsync).RequireAuthorization(Permissions.AppointmentsMarkNoShow);
        return endpoints;
    }

    private static async Task<IResult> GetRoomsAsync(ApplicationDbContext db, IPermissionService permissions,
        CancellationToken token)
    {
        if (!await permissions.HasPermissionAsync(Permissions.AppointmentsView, token)
            && !await permissions.HasPermissionAsync(Permissions.AppointmentsCreate, token)
            && !await permissions.HasPermissionAsync(Permissions.SettingsAppointments, token))
            return Results.Forbid();
        var rooms = await db.ClinicRooms.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name }).ToListAsync(token);
        return Results.Ok(rooms);
    }

    private sealed record RoomRequest(string Name);
    private sealed record AssignRoomRequest(Guid? RoomId);

    private static async Task<IResult> CreateRoomAsync(RoomRequest request, ApplicationDbContext db,
        ICurrentTenant tenant, CancellationToken token)
    {
        var room = new ClinicRoom(tenant.RequireTenantId(), request.Name);
        db.ClinicRooms.Add(room);
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException error) when (error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Results.Conflict(new { message = "A room with this name already exists." }); }
        return Results.Ok(new { room.Id, room.Name });
    }

    private static Task<AppointmentSearchResult> SearchAsync(IAppointmentQueries service, DateOnly from, DateOnly to,
        Guid? doctorProfileId, Guid? patientId, AppointmentStatus? status, AppointmentType? type,
        int page = 1, int pageSize = 100, CancellationToken token = default) =>
        service.SearchAsync(new AppointmentSearchQuery(from, to, doctorProfileId, patientId, status, type, page, pageSize), token);

    private static async Task<IResult> GetAsync(Guid id, IAppointmentQueries service, CancellationToken token) =>
        await service.GetAsync(id, token) is { } item ? Results.Ok(item) : Results.NotFound();

    private static Task<IReadOnlyCollection<AvailabilitySlot>> AvailabilityAsync(IAppointmentAvailabilityQuery service,
        Guid doctorProfileId, DateOnly date, int durationMinutes, bool isEmergency = false, CancellationToken token = default) =>
        service.GetAsync(new DoctorAvailabilityQuery(doctorProfileId, date, durationMinutes, isEmergency), token);

    private static async Task<IResult> CreateAsync(CreateAppointmentRequest request, ICreateAppointment service,
        CancellationToken token)
    {
        var id = await service.ExecuteAsync(new CreateAppointmentCommand(request.PatientId, request.DoctorProfileId,
            (AppointmentType)request.Type, Time(request.Time), request.Notes, request.RoomId, request.UseEmergencyAvailability), token);
        return Results.Created($"/api/appointments/{id:D}", new { id });
    }

    private static async Task<IResult> RescheduleAsync(Guid id, RescheduleAppointmentRequest request,
        IRescheduleAppointment service, CancellationToken token) =>
        await service.ExecuteAsync(new RescheduleAppointmentCommand(id, Time(request.Time)), token)
            ? Results.NoContent() : Results.NotFound();

    private static Task<IResult> ConfirmAsync(Guid id, IAppointmentLifecycle service, CancellationToken token) =>
        ResultAsync(service.ConfirmAsync(id, token));
    private static Task<IResult> CancelAsync(Guid id, CancelAppointmentRequest request,
        IAppointmentLifecycle service, CancellationToken token) => ResultAsync(service.CancelAsync(id, request.Reason, token));
    private static Task<IResult> CheckInAsync(Guid id, IAppointmentLifecycle service, CancellationToken token) =>
        ResultAsync(service.CheckInAsync(id, token));
    private static Task<IResult> StartAsync(Guid id, IAppointmentLifecycle service, CancellationToken token) =>
        ResultAsync(service.StartAsync(id, token));
    private static Task<IResult> CompleteAsync(Guid id, IAppointmentLifecycle service, CancellationToken token) =>
        ResultAsync(service.CompleteAsync(id, token));
    private static Task<IResult> NoShowAsync(Guid id, IAppointmentLifecycle service, CancellationToken token) =>
        ResultAsync(service.MarkNoShowAsync(id, token));

    private static AppointmentTimeInput Time(AppointmentTimeRequest request) =>
        new(request.Date, request.StartTime, request.DurationMinutes);
    private static async Task<IResult> ResultAsync(Task<bool> operation) =>
        await operation ? Results.NoContent() : Results.NotFound();
}
