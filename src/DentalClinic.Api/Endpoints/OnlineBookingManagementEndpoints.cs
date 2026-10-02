using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Infrastructure.Identity;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.Api.Endpoints;

internal static class OnlineBookingManagementEndpoints
{
    public static IEndpointRouteBuilder MapOnlineBookingManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/online-booking")
            .RequireAuthorization(AuthConstants.TenantMemberPolicy);

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
                                   appointment.PublicBookingContactedAt })
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(token);
            var items = rows.Select(row => new OnlineBookingRequestItem(row.Id, row.BookingReference!,
                $"{row.FirstName} {row.LastName}".Trim(), row.Phone, row.Email, row.Notes,
                row.DoctorName, row.StartAt, row.CreatedAt, row.Status.ToString(),
                row.PublicBookingContactedAt)).ToArray();
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
                    x.Email, x.Message, x.CreatedAt, x.ContactedAt)).ToListAsync(token);
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
        string Status, DateTimeOffset? ContactedAt);
    private sealed record BookingInquiryItem(Guid Id, string PatientName, string Phone,
        string? Email, string? Message, DateTimeOffset CreatedAt, DateTimeOffset? ContactedAt);
}
