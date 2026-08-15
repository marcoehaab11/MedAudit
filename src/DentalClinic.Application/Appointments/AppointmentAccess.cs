using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;

namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentAccess(IAppointmentStore store, IPermissionService permissions, ICurrentUser currentUser)
{
    public async Task<Guid?> VisibleDoctorAsync(CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.AppointmentsView, cancellationToken);
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, cancellationToken)) return null;
        return currentUser.UserId.HasValue
            ? await store.FindDoctorProfileIdForUserAsync(currentUser.UserId.Value, cancellationToken) ?? Guid.Empty
            : Guid.Empty;
    }

    public async Task EnsureCanModifyAsync(Appointment appointment, string permission, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(permission, cancellationToken);
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, cancellationToken)) return;
        if (!currentUser.UserId.HasValue ||
            await store.FindDoctorProfileIdForUserAsync(currentUser.UserId.Value, cancellationToken) != appointment.DoctorProfileId)
            throw new Common.Exceptions.ForbiddenAccessException("Doctors may only manage their own appointments.");
    }
}
