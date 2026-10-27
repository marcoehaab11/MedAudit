using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Platform;

public sealed class PlatformMailSettings : Entity
{
    public PlatformMailSettings() => Id = Guid.Parse("00000000-0000-0000-0000-000000000010");
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string ProtectedPassword { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "Planora";
    public string PublicAppUrl { get; set; } = string.Empty;
    public string ClinicAppUrl { get; set; } = string.Empty;
}

public sealed class PlatformEmail : Entity
{
    public string Destination { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string ProtectedBody { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public Guid? RegistrationId { get; set; }
    public string Status { get; set; } = "Pending";
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public string? LastError { get; set; }
}
