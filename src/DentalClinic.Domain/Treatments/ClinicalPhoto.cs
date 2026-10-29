using DentalClinic.Domain.Common;
namespace DentalClinic.Domain.Treatments;

public sealed class ClinicalPhoto : TenantOwnedEntity
{
    private ClinicalPhoto() { }
    public ClinicalPhoto(Guid tenantId, Guid treatmentId, Guid sessionId, string category, string fileName, string contentType, byte[] content, DateTimeOffset now)
    { TenantId = tenantId; TreatmentId = treatmentId; SessionId = sessionId; Category = category; FileName = fileName; ContentType = contentType; Content = content; CreatedAt = now; }
    public Guid TreatmentId { get; private set; }
    public Guid SessionId { get; private set; }
    public string Category { get; private set; } = "";
    public string FileName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public byte[] Content { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
}
