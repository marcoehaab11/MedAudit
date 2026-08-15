using DentalClinic.Domain.Doctors;
using DentalClinic.Domain.Patients;

namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentSchedulingValidator(IAppointmentStore store)
{
    public async Task<(Patient Patient, DoctorProfile Doctor, DateTimeOffset StartAt, DateTimeOffset EndAt)> ValidateAsync(
        Guid patientId, Guid doctorProfileId, AppointmentTimeInput time, Guid? excludeAppointmentId,
        CancellationToken cancellationToken)
    {
        var patient = await store.FindPatientAsync(patientId, cancellationToken);
        if (patient?.Status != PatientStatus.Active)
            throw AppointmentRules.Error(nameof(patientId), "An active patient in this tenant is required.");
        var doctor = await store.FindDoctorAsync(doctorProfileId, cancellationToken);
        if (doctor?.Status != DoctorProfileStatus.Active)
            throw AppointmentRules.Error(nameof(doctorProfileId), "An active doctor in this tenant is required.");
        var schedule = await store.GetScheduleAsync(doctor.Id, cancellationToken);
        AppointmentRules.EnsureScheduleFit(schedule, time.Date, time.StartTime, time.DurationMinutes);
        var zone = AppointmentRules.ResolveTimeZone(await store.GetTenantTimeZoneAsync(cancellationToken));
        var startAt = AppointmentRules.ToUtc(time.Date, time.StartTime, zone);
        var endAt = AppointmentRules.ToUtc(time.Date, time.StartTime.AddMinutes(time.DurationMinutes), zone);
        if ((endAt - startAt).TotalMinutes != time.DurationMinutes)
            throw AppointmentRules.Error(nameof(time.StartTime),
                "Appointments cannot cross a daylight-saving timezone transition.");
        if (await store.HasConflictAsync(doctor.Id, patient.Id, startAt, endAt, excludeAppointmentId, cancellationToken))
            throw new AppointmentConflictException("The selected doctor or patient is no longer available for this time.");
        return (patient, doctor, startAt, endAt);
    }
}
