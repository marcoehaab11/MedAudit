namespace DentalClinic.Infrastructure.Persistence;

// Server-only capabilities. Never populate these from a user id, role or tenant header.
public sealed class DatabaseAccessScope
{
    internal string Purpose { get; private set; } = "";
    internal string PublicSlug { get; private set; } = "";
    internal string ManagementHash { get; private set; } = "";
    internal string PatientPhone { get; private set; } = "";
    internal string IdempotencyKey { get; private set; } = "";
    internal Guid? CreatedAppointmentId { get; private set; }
    internal Guid? CreatedPatientId { get; private set; }
    internal Guid? CreatedInquiryId { get; private set; }

    public IDisposable Authentication() => Enter("identity");
    public IDisposable Onboarding() => Enter("onboarding");
    public IDisposable BranchAdministration() => Enter("branches");
    public IDisposable MailQueue() => Enter("mail");
    public IDisposable Monitoring() => Enter("monitoring");
    public IDisposable Backup() => Enter("backup");
    public IDisposable PublicBooking(string slug, string managementHash)
    {
        var restore = Enter("booking");
        PublicSlug = slug;
        ManagementHash = managementHash;
        return restore;
    }

    internal void MatchPatient(string phone) => PatientPhone = phone;
    internal void MatchIdempotency(string key) => IdempotencyKey = key;
    internal void CreatedAppointment(Guid id) => CreatedAppointmentId = id;
    internal void CreatedPatient(Guid id) => CreatedPatientId = id;
    internal void CreatedInquiry(Guid id) => CreatedInquiryId = id;

    private Restore Enter(string purpose)
    {
        var previous = (Purpose, PublicSlug, ManagementHash, PatientPhone, IdempotencyKey, CreatedAppointmentId, CreatedPatientId, CreatedInquiryId);
        Purpose = purpose;
        return new Restore(() => (Purpose, PublicSlug, ManagementHash, PatientPhone, IdempotencyKey, CreatedAppointmentId, CreatedPatientId, CreatedInquiryId) = previous);
    }

    private sealed class Restore(Action restore) : IDisposable
    {
        public void Dispose() => restore();
    }
}
