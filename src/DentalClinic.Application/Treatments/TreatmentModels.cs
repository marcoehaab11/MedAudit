using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Treatments;

namespace DentalClinic.Application.Treatments;

public sealed record CatalogItemInput(TreatmentType Type, string Name, string Code, string? Description, decimal DefaultPrice, bool IsActive = true);
public sealed record CatalogItemDetails(Guid Id, TreatmentType Type, string Name, string Code, string? Description,
    decimal DefaultPrice, bool IsActive, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record PlanItemInput(Guid CatalogItemId, int? ToothNumber, int Quantity, decimal DiscountAmount, string? Notes);
public sealed record CreateTreatmentPlanCommand(Guid PatientId, Guid DoctorProfileId, string Title, string? Notes,
    decimal DiscountAmount, IReadOnlyCollection<PlanItemInput> Items);
public sealed record UpdateTreatmentPlanCommand(Guid Id, string Title, string? Notes, decimal DiscountAmount, Guid Version);
public sealed record UpdatePlanItemCommand(Guid PlanId, Guid ItemId, int? ToothNumber, int Quantity,
    decimal DiscountAmount, string? Notes, Guid Version);
public sealed record TreatmentPlanItemDetails(Guid Id, Guid CatalogItemId, TreatmentType Type, string TreatmentName,
    int? ToothNumber, int Quantity, decimal UnitPrice, decimal DiscountAmount, decimal Total, string? Notes,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record TreatmentPlanDetails(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, string Title, string? Notes, TreatmentPlanStatus Status, decimal Subtotal,
    decimal DiscountAmount, decimal Total, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateTimeOffset? ProposedAt, DateTimeOffset? AcceptedAt, DateTimeOffset? RejectedAt,
    DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt, Guid Version,
    IReadOnlyCollection<TreatmentPlanItemDetails> Items);
public sealed record TreatmentPlanListItem(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, string Title, TreatmentPlanStatus Status, decimal Total, DateTimeOffset CreatedAt);
public sealed record TreatmentPlanSearch(Guid? PatientId = null, Guid? DoctorProfileId = null,
    TreatmentPlanStatus? Status = null, DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);

public sealed record CreateTreatmentCommand(Guid PatientId, Guid DoctorProfileId, Guid CatalogItemId,
    Guid? AppointmentId, Guid? TreatmentPlanItemId, Guid? SourceDentalProcedureId,
    IReadOnlyCollection<int> ToothNumbers, string? Notes);
public sealed record TreatmentDetails(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, Guid? AppointmentId, Guid? TreatmentPlanId, Guid? TreatmentPlanItemId,
    Guid CatalogItemId, Guid? SourceDentalProcedureId, TreatmentType Type, string TreatmentName,
    IReadOnlyCollection<int> ToothNumbers, TreatmentStatus Status, decimal Price, string? Notes,
    DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt, DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt, Guid Version);
public sealed record TreatmentListItem(Guid Id, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, TreatmentType Type, string TreatmentName, IReadOnlyCollection<int> ToothNumbers,
    TreatmentStatus Status, decimal Price, DateTimeOffset CreatedAt, DateTimeOffset? CompletedAt);
public sealed record TreatmentSearch(Guid? PatientId = null, Guid? DoctorProfileId = null,
    TreatmentType? Type = null, TreatmentStatus? Status = null, DateOnly? From = null,
    DateOnly? To = null, int? ToothNumber = null, int Page = 1, int PageSize = 20);
public sealed record TreatmentPatient(Guid Id, string Name, bool IsActive);
public sealed record TreatmentDoctor(Guid Id, Guid UserId, string Name, bool IsActive);
public sealed record TreatmentAppointment(Guid Id, Guid PatientId, Guid DoctorProfileId);
public sealed record DentalProcedureReference(Guid Id, Guid PatientId, int ToothNumber);
public sealed record PlanExecutionSource(Guid PlanId, Guid PlanItemId, Guid PatientId, Guid DoctorProfileId,
    Guid CatalogItemId, TreatmentType Type, string Name, int? ToothNumber, decimal Price, TreatmentPlanStatus PlanStatus);
public sealed class TreatmentNotFoundException(string message) : Exception(message);
