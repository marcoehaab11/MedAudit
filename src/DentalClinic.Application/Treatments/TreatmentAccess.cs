using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;

namespace DentalClinic.Application.Treatments;

internal sealed class TreatmentAccess(ITreatmentStore store, IPermissionService permissions, ICurrentUser currentUser)
{
    public async Task<Guid?> VisibleDoctorAsync(string permission, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(permission, token);
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token)) return null;
        return currentUser.UserId.HasValue
            ? await store.FindDoctorProfileIdForUserAsync(currentUser.UserId.Value, token) ?? Guid.Empty
            : Guid.Empty;
    }
    public async Task EnsureDoctorAsync(Guid doctorId, string permission, CancellationToken token)
    {
        var visible = await VisibleDoctorAsync(permission, token);
        if (visible.HasValue && visible != doctorId) throw new ForbiddenAccessException("Doctors may only access their own treatment records.");
    }
}
