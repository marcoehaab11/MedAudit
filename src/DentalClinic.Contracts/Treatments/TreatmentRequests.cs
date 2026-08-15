namespace DentalClinic.Contracts.Treatments;

public sealed record CatalogItemRequest(int Type, string Name, string Code, string? Description, decimal DefaultPrice, bool IsActive = true);
public sealed record PlanItemRequest(Guid CatalogItemId, int? ToothNumber, int Quantity, decimal DiscountAmount, string? Notes);
public sealed record CreateTreatmentPlanRequest(Guid PatientId, Guid DoctorProfileId, string Title, string? Notes, decimal DiscountAmount, IReadOnlyCollection<PlanItemRequest> Items);
public sealed record UpdateTreatmentPlanRequest(string Title, string? Notes, decimal DiscountAmount, Guid Version);
public sealed record UpdatePlanItemRequest(int? ToothNumber, int Quantity, decimal DiscountAmount, string? Notes, Guid Version);
public sealed record TreatmentVersionRequest(Guid Version);
public sealed record CreateTreatmentRequest(Guid PatientId, Guid DoctorProfileId, Guid CatalogItemId, Guid? AppointmentId,
    Guid? TreatmentPlanItemId, Guid? SourceDentalProcedureId, IReadOnlyCollection<int> ToothNumbers, string? Notes);
public sealed record UpdateTreatmentNotesRequest(string? Notes, Guid Version);
