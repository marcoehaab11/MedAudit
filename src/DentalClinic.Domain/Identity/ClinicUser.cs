using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class ClinicUser : TenantOwnedEntity
{
    private ClinicUser() { }

    public ClinicUser(
        Guid id,
        Guid tenantId,
        string displayName,
        string? phone,
        DateTimeOffset createdAt)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            throw new ArgumentException("User and tenant IDs are required.");
        }

        Id = id;
        TenantId = tenantId;
        DisplayName = Required(displayName, nameof(displayName), 200);
        Phone = Optional(phone, nameof(phone), 50);
        Status = UserStatus.Invited;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public string DisplayName { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public UserStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Update(string displayName, string? phone, DateTimeOffset updatedAt)
    {
        DisplayName = Required(displayName, nameof(displayName), 200);
        Phone = Optional(phone, nameof(phone), 50);
        UpdatedAt = updatedAt;
    }

    public void AcceptInvitation(DateTimeOffset acceptedAt)
    {
        if (Status != UserStatus.Invited)
        {
            throw new InvalidOperationException("Only an invited user can accept an invitation.");
        }

        Status = UserStatus.Active;
        UpdatedAt = acceptedAt;
    }

    public void Activate(DateTimeOffset updatedAt)
    {
        if (Status == UserStatus.Invited)
        {
            throw new InvalidOperationException("An invited user must accept the invitation first.");
        }

        Status = UserStatus.Active;
        UpdatedAt = updatedAt;
    }

    public void Deactivate(DateTimeOffset updatedAt)
    {
        if (Status == UserStatus.Invited)
        {
            throw new InvalidOperationException("A pending invitation must be cancelled instead.");
        }

        Status = UserStatus.Inactive;
        UpdatedAt = updatedAt;
    }

    public void CancelInvitation(DateTimeOffset updatedAt)
    {
        if (Status != UserStatus.Invited)
        {
            throw new InvalidOperationException("Only an invited user can have its invitation cancelled.");
        }

        Status = UserStatus.Inactive;
        UpdatedAt = updatedAt;
    }

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

    private static string? Optional(string? value, string parameterName, int maximumLength) =>
        string.IsNullOrWhiteSpace(value) ? null : Required(value, parameterName, maximumLength);
}
