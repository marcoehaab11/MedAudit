using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Domain.Identity;
using DentalClinic.Domain.Appointments;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static class OnlineBookingManagementEndpoints
{
    public static IEndpointRouteBuilder MapOnlineBookingManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/online-booking")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy);

        group.MapGet("/staff", async (ApplicationDbContext db, ICurrentTenant currentTenant, CancellationToken token) =>
            Results.Ok(await db.ClinicUsers.AsNoTracking()
                .Where(x => x.TenantId == currentTenant.RequireTenantId() && x.Status == UserStatus.Active)
                .OrderBy(x => x.DisplayName).Select(x => new { x.Id, x.DisplayName }).ToListAsync(token)))
            .RequireAuthorization(Permissions.AppointmentsView);

        group.MapGet("/summary", async (ApplicationDbContext db, ICurrentTenant currentTenant, CancellationToken token) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            var now = DateTimeOffset.UtcNow;
            var since = now.AddDays(-30);
            var overdue = now.AddHours(-2);
            var bookings = db.Appointments.AsNoTracking().Where(x => x.TenantId == tenantId && x.BookingReference != null);
            var inquiries = db.BookingInquiries.AsNoTracking().Where(x => x.TenantId == tenantId);
            var visits = db.BookingPageVisits.AsNoTracking().Where(x => x.TenantId == tenantId && x.CreatedAt >= since);
            var sources = await visits.GroupBy(x => x.Source).Select(x => new { source = x.Key, count = x.Count() }).ToListAsync(token);
            var bookingSources = await bookings.Where(x => x.CreatedAt >= since)
                .GroupBy(x => x.PublicBookingSource ?? "direct")
                .Select(x => new { source = x.Key, count = x.Count() }).ToListAsync(token);
            return Results.Ok(new {
                visits30Days = await visits.CountAsync(token),
                sources,
                bookingSources,
                bookings30Days = await bookings.CountAsync(x => x.CreatedAt >= since, token),
                inquiries30Days = await inquiries.CountAsync(x => x.CreatedAt >= since, token),
                awaitingContact = await bookings.CountAsync(x => x.PublicBookingContactedAt == null && x.Status != AppointmentStatus.Cancelled, token)
                    + await inquiries.CountAsync(x => x.ContactedAt == null && x.Status == "New", token),
                overdue = await bookings.CountAsync(x => x.Status != AppointmentStatus.Cancelled &&
                    ((x.PublicBookingContactedAt == null && x.CreatedAt < overdue) || x.PublicBookingFollowUpAt < now), token)
                    + await inquiries.CountAsync(x => x.Status != "Closed" &&
                        ((x.ContactedAt == null && x.CreatedAt < overdue) || x.FollowUpAt < now), token),
                completed30Days = await bookings.CountAsync(x => x.Status == AppointmentStatus.Completed && x.StartAt >= since, token),
                noShows30Days = await bookings.CountAsync(x => x.Status == AppointmentStatus.NoShow && x.StartAt >= since, token)
            });
        }).RequireAuthorization(Permissions.AppointmentsView);

        group.MapGet("/requests", async (ApplicationDbContext db, ICurrentTenant currentTenant,
            int page = 1, CancellationToken token = default) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            page = Math.Max(1, page);
            const int pageSize = 20;
            var query = db.Appointments.AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.BookingReference != null);
            var total = await query.CountAsync(token);
            var rows = await (from appointment in query
                               join patient in db.Patients on appointment.PatientId equals patient.Id
                               join doctor in db.DoctorProfiles on appointment.DoctorProfileId equals doctor.Id
                               join doctorUser in db.ClinicUsers on doctor.ClinicUserId equals doctorUser.Id
                               orderby appointment.CreatedAt descending
                               select new { appointment.Id, appointment.BookingReference,
                                   patient.FirstName, patient.LastName, patient.Phone, patient.Email,
                                   appointment.Notes, DoctorName = doctorUser.DisplayName,
                                   appointment.StartAt, appointment.CreatedAt, appointment.Status,
                                   appointment.PublicBookingContactedAt, appointment.PublicBookingAssignedToUserId,
                                   appointment.PublicBookingStaffNotes, appointment.PublicBookingFollowUpAt })
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(token);
            var items = rows.Select(row => new OnlineBookingRequestItem(row.Id, row.BookingReference!,
                $"{row.FirstName} {row.LastName}".Trim(), row.Phone, row.Email, row.Notes,
                row.DoctorName, row.StartAt, row.CreatedAt, row.Status.ToString(),
                row.PublicBookingContactedAt, row.PublicBookingAssignedToUserId,
                row.PublicBookingStaffNotes, row.PublicBookingFollowUpAt)).ToArray();
            return Results.Ok(new { items, total, page, pageSize });
        }).RequireAuthorization(Permissions.AppointmentsView);

        group.MapGet("/inquiries", async (ApplicationDbContext db, ICurrentTenant currentTenant,
            int page = 1, CancellationToken token = default) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            page = Math.Max(1, page);
            const int pageSize = 20;
            var query = db.BookingInquiries.AsNoTracking().Where(x => x.TenantId == tenantId);
            var total = await query.CountAsync(token);
            var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize)
                .Take(pageSize).Select(x => new BookingInquiryItem(x.Id, x.PatientName, x.Phone,
                    x.Email, x.Message, x.CreatedAt, x.ContactedAt, x.Status,
                    x.AssignedToUserId, x.StaffNotes, x.FollowUpAt)).ToListAsync(token);
            return Results.Ok(new { items, total, page, pageSize });
        }).RequireAuthorization(Permissions.AppointmentsView);

        group.MapPost("/inquiries/{id:guid}/contacted", async (Guid id, ApplicationDbContext db,
            ICurrentTenant currentTenant, CancellationToken token) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            var inquiry = await db.BookingInquiries.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, token);
            if (inquiry is null) return Results.NotFound();
            inquiry.MarkContacted(DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(token);
            return Results.NoContent();
        }).RequireAuthorization(Permissions.AppointmentsEdit);

        group.MapPut("/inquiries/{id:guid}/follow-up", async (Guid id, FollowUpUpdate request,
            ApplicationDbContext db, ICurrentTenant currentTenant, CancellationToken token) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            var inquiry = await db.BookingInquiries.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, token);
            if (inquiry is null) return Results.NotFound();
            if (request.AssignedToUserId is Guid assignee && !await db.ClinicUsers.AnyAsync(x => x.TenantId == tenantId && x.Id == assignee && x.Status == UserStatus.Active, token))
                return Results.BadRequest(new { title = "Choose an active clinic staff member." });
            try { inquiry.UpdateFollowUp(request.Status ?? inquiry.Status, request.AssignedToUserId, request.Notes, request.FollowUpAt, DateTimeOffset.UtcNow); }
            catch (ArgumentException ex) { return Results.BadRequest(new { title = ex.Message }); }
            await db.SaveChangesAsync(token);
            return Results.NoContent();
        }).RequireAuthorization(Permissions.AppointmentsEdit);

        group.MapPut("/requests/{id:guid}/follow-up", async (Guid id, FollowUpUpdate request,
            ApplicationDbContext db, ICurrentTenant currentTenant, CancellationToken token) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            var booking = await db.Appointments.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id && x.BookingReference != null, token);
            if (booking is null) return Results.NotFound();
            if (request.AssignedToUserId is Guid assignee && !await db.ClinicUsers.AnyAsync(x => x.TenantId == tenantId && x.Id == assignee && x.Status == UserStatus.Active, token))
                return Results.BadRequest(new { title = "Choose an active clinic staff member." });
            try { booking.UpdatePublicBookingFollowUp(request.AssignedToUserId, request.Notes, request.FollowUpAt, DateTimeOffset.UtcNow); }
            catch (ArgumentException ex) { return Results.BadRequest(new { title = ex.Message }); }
            await db.SaveChangesAsync(token);
            return Results.NoContent();
        }).RequireAuthorization(Permissions.AppointmentsEdit);

        group.MapPost("/requests/{id:guid}/contacted", async (Guid id, ApplicationDbContext db,
            ICurrentTenant currentTenant, CancellationToken token) =>
        {
            var tenantId = currentTenant.RequireTenantId();
            var booking = await db.Appointments.SingleOrDefaultAsync(
                a => a.TenantId == tenantId && a.Id == id && a.BookingReference != null, token);
            if (booking is null) return Results.NotFound();
            booking.MarkPublicBookingContacted(DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(token);
            return Results.NoContent();
        }).RequireAuthorization(Permissions.AppointmentsEdit);

        return endpoints;
    }

    private sealed record OnlineBookingRequestItem(Guid Id, string BookingReference,
        string PatientName, string PatientPhone, string? PatientEmail, string? Notes,
        string DoctorName, DateTimeOffset StartAt, DateTimeOffset CreatedAt,
        string Status, DateTimeOffset? ContactedAt, Guid? AssignedToUserId,
        string? StaffNotes, DateTimeOffset? FollowUpAt);
    private sealed record BookingInquiryItem(Guid Id, string PatientName, string Phone,
        string? Email, string? Message, DateTimeOffset CreatedAt, DateTimeOffset? ContactedAt,
        string Status, Guid? AssignedToUserId, string? StaffNotes, DateTimeOffset? FollowUpAt);
    private sealed record FollowUpUpdate(string? Status, Guid? AssignedToUserId, string? Notes, DateTimeOffset? FollowUpAt);
}
