namespace DentalClinic.Application.Platform;

public interface IPlatformAccessContext
{
    bool IsPlatformAdmin { get; }
    Guid? UserId { get; }
    string? CorrelationId { get; }
}
