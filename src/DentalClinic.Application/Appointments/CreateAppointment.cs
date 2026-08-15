using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Application.Identity;
using DentalClinic.Domain.Appointments;
using DentalClinic.Domain.Platform;

namespace DentalClinic.Application.Appointments;

internal sealed class CreateAppointment(IAppointmentStore store, AppointmentSchedulingValidator validator,
    IPermissionService permissions, ICurrentTenant currentTenant, ICurrentUser currentUser, ISystemClock clock)
    : ICreateAppointment
{
    public async Task<Guid> ExecuteAsync(CreateAppointmentCommand command, CancellationToken cancellationToken)
    {
        await permissions.EnsurePermissionAsync(Permissions.AppointmentsCreate, cancellationToken);
        if (!Enum.IsDefined(command.Type)) throw AppointmentRules.Error(nameof(command.Type), "Appointment type is invalid.");
        if (command.Notes?.Trim().Length > 2000)
            throw AppointmentRules.Error(nameof(command.Notes), "Notes cannot exceed 2000 characters.");
        var valid = await validator.ValidateAsync(command.PatientId, command.DoctorProfileId,
            command.Time, null, cancellationToken);
        var appointment = new Appointment(currentTenant.RequireTenantId(), valid.Patient.Id, valid.Doctor.Id,
            command.Type, valid.StartAt, command.Time.DurationMinutes, command.Notes,
            currentUser.UserId ?? throw new Common.Exceptions.ForbiddenAccessException("An authenticated user is required."),
            clock.UtcNow);
        store.Add(appointment);
        store.AddAudit(Audit(PlatformAuditAction.AppointmentCreated, appointment.Id));
        await store.SaveChangesAsync(cancellationToken);
        return appointment.Id;
    }

    private PlatformAuditLog Audit(PlatformAuditAction action, Guid id) => new(currentTenant.RequireTenantId(),
        currentUser.UserId, action, nameof(Appointment), id, clock.UtcNow, null);
}
