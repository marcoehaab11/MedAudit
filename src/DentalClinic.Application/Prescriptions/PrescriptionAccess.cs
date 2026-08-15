using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Identity;

namespace DentalClinic.Application.Prescriptions;

internal sealed class PrescriptionAccess(IPrescriptionStore store, IPermissionService permissions, ICurrentUser user)
{
    public async Task<Guid?> VisibleDoctorAsync(string permission, CancellationToken token)
    {
        await permissions.EnsurePermissionAsync(permission, token);
        if (await permissions.HasPermissionAsync(Permissions.AppointmentsManageSchedule, token)) return null;
        return user.UserId.HasValue ? await store.FindDoctorProfileIdForUserAsync(user.UserId.Value, token) ?? Guid.Empty : Guid.Empty;
    }
    public async Task EnsureDoctorAsync(Guid doctorId, string permission, CancellationToken token)
    { var visible = await VisibleDoctorAsync(permission, token); if (visible.HasValue && visible.Value != doctorId) throw new ForbiddenAccessException("Prescription access is restricted to the treating doctor."); }
}
