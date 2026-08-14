using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Doctors;

internal sealed class DoctorCompensationService(IDoctorCompensationStore store, IPermissionService permissions,
    ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock) : IDoctorCompensationService
{
    public async Task<IReadOnlyCollection<DoctorCompensationModel>?> GetHistoryAsync(Guid doctorProfileId, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsManageCompensation, cancellationToken);
        if (await store.FindDoctorAsync(doctorProfileId, cancellationToken) is null) return null;
        return (await store.GetHistoryAsync(doctorProfileId, false, cancellationToken)).Select(Map).ToArray();
    }

    public async Task<Guid?> CreateAsync(CreateDoctorCompensationCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsManageCompensation, cancellationToken);
        var doctor = await ActiveDoctorAsync(command.DoctorProfileId, cancellationToken);
        if (doctor is null) return null;
        var item = New(doctor, command.Compensation);
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        if (await store.HasOverlapAsync(doctor.Id, item.EffectiveFrom, item.EffectiveTo, null, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Compensation.EffectiveFrom), "Compensation periods cannot overlap.");
        store.Add(item); Audit(PlatformAuditAction.DoctorCompensationCreated, item.Id);
        await store.SaveChangesAsync(cancellationToken); await transaction.CommitAsync(cancellationToken);
        return item.Id;
    }

    public async Task<Guid?> UpdateAsync(UpdateDoctorCompensationCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.DoctorsManageCompensation, cancellationToken);
        var doctor = await ActiveDoctorAsync(command.DoctorProfileId, cancellationToken);
        if (doctor is null) return null;
        var successor = New(doctor, command.Compensation);
        await using var transaction = await store.BeginTransactionAsync(cancellationToken);
        var history = await store.GetHistoryAsync(doctor.Id, true, cancellationToken);
        if (history.Any(x => x.EffectiveFrom >= successor.EffectiveFrom))
            throw DoctorValidation.Error(nameof(command.Compensation.EffectiveFrom), "A compensation change must begin after existing historical rules.");
        var current = history.SingleOrDefault(x => !x.EffectiveTo.HasValue || x.EffectiveTo >= successor.EffectiveFrom);
        if (current is not null)
        {
            current.Close(successor.EffectiveFrom.AddDays(-1), clock.UtcNow);
            await store.SaveChangesAsync(cancellationToken);
        }
        if (await store.HasOverlapAsync(doctor.Id, successor.EffectiveFrom, successor.EffectiveTo, null, cancellationToken))
            throw DoctorValidation.Error(nameof(command.Compensation.EffectiveFrom), "Compensation periods cannot overlap.");
        store.Add(successor); Audit(PlatformAuditAction.DoctorCompensationUpdated, successor.Id);
        await store.SaveChangesAsync(cancellationToken); await transaction.CommitAsync(cancellationToken);
        return successor.Id;
    }

    private async Task<DoctorProfile?> ActiveDoctorAsync(Guid id, CancellationToken cancellationToken)
    {
        var doctor = await store.FindDoctorAsync(id, cancellationToken);
        if (doctor?.Status == DoctorProfileStatus.Archived)
            throw DoctorValidation.Error(nameof(id), "Archived doctors cannot receive new compensation rules.");
        return doctor;
    }
    private DoctorCompensation New(DoctorProfile doctor, DoctorCompensationInput x) => new(doctor.TenantId, doctor.Id,
        x.CompensationType, x.FixedAmount, x.Percentage, x.EffectiveFrom, x.EffectiveTo, clock.UtcNow);
    private void Audit(PlatformAuditAction action, Guid id) => store.AddAudit(new PlatformAuditLog(
        currentTenant.RequireTenantId(), currentUser.UserId, action, nameof(DoctorCompensation), id, clock.UtcNow, null));
    private static DoctorCompensationModel Map(DoctorCompensation x) => new(x.Id, x.CompensationType,
        x.FixedAmount, x.Percentage, x.EffectiveFrom, x.EffectiveTo, x.CreatedAt, x.UpdatedAt);
}
