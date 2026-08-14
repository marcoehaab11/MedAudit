using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Doctors;

public sealed class DoctorProfile : TenantOwnedEntity
{
    private DoctorProfile() { }

    public DoctorProfile(Guid tenantId, Guid clinicUserId, string specialization, string licenseNumber,
        string? bio, int consultationDurationMinutes, DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || clinicUserId == Guid.Empty)
            throw new ArgumentException("Tenant and clinic user IDs are required.");
        TenantId = tenantId;
        ClinicUserId = clinicUserId;
        Apply(specialization, licenseNumber, bio, consultationDurationMinutes);
        Status = DoctorProfileStatus.Active;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public Guid ClinicUserId { get; private set; }
    public string Specialization { get; private set; } = string.Empty;
    public string LicenseNumber { get; private set; } = string.Empty;
    public string? Bio { get; private set; }
    public int ConsultationDurationMinutes { get; private set; }
    public DoctorProfileStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string specialization, string licenseNumber, string? bio,
        int consultationDurationMinutes, DateTimeOffset updatedAt)
    {
        EnsureNotArchived();
        Apply(specialization, licenseNumber, bio, consultationDurationMinutes);
        UpdatedAt = updatedAt;
    }

    public void Activate(DateTimeOffset updatedAt) { EnsureNotArchived(); Status = DoctorProfileStatus.Active; UpdatedAt = updatedAt; }
    public void Deactivate(DateTimeOffset updatedAt) { EnsureNotArchived(); Status = DoctorProfileStatus.Inactive; UpdatedAt = updatedAt; }
    public void Archive(DateTimeOffset updatedAt) { if (Status == DoctorProfileStatus.Archived) return; Status = DoctorProfileStatus.Archived; UpdatedAt = updatedAt; }

    private void Apply(string specialization, string licenseNumber, string? bio, int duration)
    {
        Specialization = DoctorField.Required(specialization, nameof(specialization), 150);
        LicenseNumber = DoctorField.Required(licenseNumber, nameof(licenseNumber), 100).ToUpperInvariant();
        Bio = DoctorField.Optional(bio, nameof(bio), 2000);
        if (duration is < 5 or > 480) throw new ArgumentOutOfRangeException(nameof(duration));
        ConsultationDurationMinutes = duration;
    }

    private void EnsureNotArchived()
    {
        if (Status == DoctorProfileStatus.Archived)
            throw new InvalidOperationException("Archived doctor profiles cannot be modified.");
    }
}

internal static class DoctorField
{
    public static string Required(string value, string parameterName, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("Value is required.", parameterName);
        var normalized = value.Trim();
        return normalized.Length <= max ? normalized : throw new ArgumentException($"Value cannot exceed {max} characters.", parameterName);
    }
    public static string? Optional(string? value, string parameterName, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : Required(value, parameterName, max);
}
