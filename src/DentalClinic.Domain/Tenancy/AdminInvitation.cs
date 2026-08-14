using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Tenancy;

public sealed class AdminInvitation : TenantOwnedEntity
{
    private AdminInvitation() { }

    public AdminInvitation(
        Guid tenantId,
        Guid userId,
        string email,
        string role,
        string tokenHash,
        DateTimeOffset expiresAt,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || userId == Guid.Empty)
        {
            throw new ArgumentException("Tenant and user IDs are required.");
        }

        if (expiresAt <= createdAt)
        {
            throw new ArgumentException("Invitation expiration must be in the future.", nameof(expiresAt));
        }

        TenantId = tenantId;
        UserId = userId;
        Email = Required(email, nameof(email), 256).ToLowerInvariant();
        Role = Required(role, nameof(role), 100);
        TokenHash = Required(tokenHash, nameof(tokenHash), 64);
        ExpiresAt = expiresAt;
        CreatedAt = createdAt;
        Status = AdminInvitationStatus.Pending;
    }

    public Guid UserId { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string Role { get; private set; } = string.Empty;
    public string TokenHash { get; private set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? AcceptedAt { get; private set; }
    public AdminInvitationStatus Status { get; private set; }

    public bool TryAccept(DateTimeOffset acceptedAt)
    {
        if (Status != AdminInvitationStatus.Pending)
        {
            return false;
        }

        if (acceptedAt >= ExpiresAt)
        {
            Status = AdminInvitationStatus.Expired;
            return false;
        }

        Status = AdminInvitationStatus.Accepted;
        AcceptedAt = acceptedAt;
        return true;
    }

    public void Cancel()
    {
        if (Status == AdminInvitationStatus.Pending)
        {
            Status = AdminInvitationStatus.Cancelled;
        }
    }

    public AdminInvitationStatus GetEffectiveStatus(DateTimeOffset now) =>
        Status == AdminInvitationStatus.Pending && now >= ExpiresAt
            ? AdminInvitationStatus.Expired
            : Status;

    private static string Required(string value, string parameterName, int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value is required.", parameterName);
        }

        var normalized = value.Trim();
        return normalized.Length > maximumLength
            ? throw new ArgumentException($"Value cannot exceed {maximumLength} characters.", parameterName)
            : normalized;
    }
}
