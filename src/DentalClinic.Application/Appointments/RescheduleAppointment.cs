using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Appointments;

internal sealed class RescheduleAppointment(IAppointmentStore store, AppointmentSchedulingValidator validator,
    AppointmentAccess access, ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock)
    : IRescheduleAppointment
{
    public async Task<bool> ExecuteAsync(RescheduleAppointmentCommand command, CancellationToken cancellationToken)
    {
        var appointment = await store.FindAsync(command.AppointmentId, true, cancellationToken);
        if (appointment is null) return false;
        await access.EnsureCanModifyAsync(appointment, Permissions.AppointmentsEdit, cancellationToken);
        if (appointment.Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
            throw AppointmentRules.Error(nameof(command.AppointmentId), "Only scheduled or confirmed appointments can be rescheduled.");
        var valid = await validator.ValidateAsync(appointment.PatientId, appointment.DoctorProfileId,
            command.Time, appointment.Id, cancellationToken);
        appointment.Reschedule(valid.StartAt, command.Time.DurationMinutes, clock.UtcNow);
        store.AddAudit(new PlatformAuditLog(currentTenant.RequireTenantId(), currentUser.UserId,
            PlatformAuditAction.AppointmentRescheduled, nameof(Appointment), appointment.Id, clock.UtcNow, null));
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }
}
