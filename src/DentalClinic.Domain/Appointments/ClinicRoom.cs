using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Appointments;

public sealed class ClinicRoom : TenantOwnedEntity
{
    private ClinicRoom() { }

    public ClinicRoom(Guid tenantId, string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        name = name.Trim();
        if (name.Length > 80) throw new ArgumentException("Room names cannot exceed 80 characters.");
        TenantId = tenantId;
        Name = name;
    }

    public string Name { get; private set; } = string.Empty;
}
