using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Platform;

public sealed class ClinicRegistration : Entity
{
    public Guid IdentityUserId { get; set; }
    public Guid? TenantId { get; set; }
    public string ClinicName { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public byte[]? Logo { get; set; }
    public string? LogoContentType { get; set; }
    public bool ShowcaseConsent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public DateTimeOffset? LastConfirmationSentAt { get; set; }
}
