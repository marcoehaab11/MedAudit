using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentLifecycle(IAppointmentStore store, AppointmentAccess access,
    ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock) : IAppointmentLifecycle
{
    public Task<bool> ConfirmAsync(Guid id, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsEdit, PlatformAuditAction.AppointmentConfirmed, x => x.Confirm(clock.UtcNow), cancellationToken);

    public Task<bool> CancelAsync(Guid id, string reason, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsCancel, PlatformAuditAction.AppointmentCancelled, x => x.Cancel(reason, clock.UtcNow), cancellationToken);

    public Task<bool> CheckInAsync(Guid id, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsCheckIn, PlatformAuditAction.AppointmentCheckedIn, x => x.CheckIn(clock.UtcNow), cancellationToken);

    public Task<bool> StartAsync(Guid id, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsStart, PlatformAuditAction.AppointmentStarted, x => x.Start(clock.UtcNow), cancellationToken);

    public Task<bool> CompleteAsync(Guid id, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsComplete, PlatformAuditAction.AppointmentCompleted, x => x.Complete(clock.UtcNow), cancellationToken);

    public Task<bool> MarkNoShowAsync(Guid id, CancellationToken cancellationToken) => TransitionAsync(id,
        Permissions.AppointmentsMarkNoShow, PlatformAuditAction.AppointmentMarkedNoShow,
        x => x.MarkNoShow(clock.UtcNow), cancellationToken);

    private async Task<bool> TransitionAsync(Guid id, string permission, PlatformAuditAction action,
        Action<Appointment> transition, CancellationToken cancellationToken)
    {
        var appointment = await store.FindAsync(id, true, cancellationToken);
        if (appointment is null) return false;
        await access.EnsureCanModifyAsync(appointment, permission, cancellationToken);
        try { transition(appointment); }
        catch (ArgumentException exception) { throw AppointmentRules.Error(nameof(id), exception.Message); }
        catch (InvalidOperationException exception) { throw AppointmentRules.Error(nameof(id), exception.Message); }
        store.AddAudit(new PlatformAuditLog(currentTenant.RequireTenantId(), currentUser.UserId,
            action, nameof(Appointment), appointment.Id, clock.UtcNow, null));
        await store.SaveChangesAsync(cancellationToken);
        return true;
    }
}
