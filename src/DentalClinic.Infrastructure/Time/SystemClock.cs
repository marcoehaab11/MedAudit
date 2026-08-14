using DentalClinic.Application.Common.Interfaces;

namespace DentalClinic.Infrastructure.Time;

internal sealed class SystemClock : ISystemClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
