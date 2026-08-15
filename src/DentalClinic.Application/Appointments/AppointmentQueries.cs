namespace DentalClinic.Application.Appointments;

internal sealed class AppointmentQueries(IAppointmentStore store, AppointmentAccess access) : IAppointmentQueries
{
    public async Task<AppointmentDetails?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var visibleDoctor = await access.VisibleDoctorAsync(cancellationToken);
        return await store.GetDetailsAsync(id, visibleDoctor, cancellationToken);
    }

    public async Task<AppointmentSearchResult> SearchAsync(AppointmentSearchQuery query, CancellationToken cancellationToken)
    {
        if (query.Status.HasValue && !Enum.IsDefined(query.Status.Value))
            throw AppointmentRules.Error(nameof(query.Status), "Appointment status is invalid.");
        if (query.Type.HasValue && !Enum.IsDefined(query.Type.Value))
            throw AppointmentRules.Error(nameof(query.Type), "Appointment type is invalid.");
        var visibleDoctor = await access.VisibleDoctorAsync(cancellationToken);
        var timeZone = await store.GetTenantTimeZoneAsync(cancellationToken);
        var range = AppointmentRules.UtcRange(query.From, query.To, AppointmentRules.ResolveTimeZone(timeZone));
        var normalized = query with { Page = Math.Max(1, query.Page), PageSize = Math.Clamp(query.PageSize, 1, 250) };
        return new AppointmentSearchResult(
            await store.SearchAsync(normalized, range.From, range.To, visibleDoctor, timeZone, cancellationToken), timeZone);
    }
}
