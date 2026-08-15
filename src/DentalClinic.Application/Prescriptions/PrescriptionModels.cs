using DentalClinic.Application.Tenants.Models;
using DentalClinic.Domain.Prescriptions;

namespace DentalClinic.Application.Prescriptions;

public sealed record MedicationCatalogInput(string Name, string? GenericName, string? Strength, MedicationForm? Form, string? Notes, bool IsActive = true);
public sealed record MedicationCatalogDetails(Guid Id, string Name, string? GenericName, string? Strength, MedicationForm? Form, bool IsActive);
public sealed record MedicationSearch(string? Search = null, MedicationForm? Form = null, bool IncludeInactive = false, int Page = 1, int PageSize = 20);
public sealed record PrescriptionItemInput(Guid? MedicationId, string? MedicationName, string? GenericName, string? Strength, MedicationForm? Form,
    string Dose, string Frequency, string Duration, string? Route, string Instructions, int? Quantity, int SortOrder);
public sealed record CreatePrescriptionCommand(Guid PatientId, Guid DoctorProfileId, Guid? AppointmentId, Guid? ExaminationId,
    Guid? TreatmentId, string? Notes, IReadOnlyCollection<PrescriptionItemInput> Items);
public sealed record UpdatePrescriptionCommand(Guid Id, Guid PatientId, Guid DoctorProfileId, Guid? AppointmentId, Guid? ExaminationId,
    Guid? TreatmentId, string? Notes, Guid Version);
public sealed record UpdatePrescriptionItemCommand(Guid PrescriptionId, Guid ItemId, string Dose, string Frequency, string Duration,
    string? Route, string Instructions, int? Quantity, int SortOrder, Guid Version);
public sealed record PrescriptionItemDetails(Guid Id, Guid? MedicationId, string MedicationName, string? GenericName, string? Strength,
    MedicationForm? Form, string Dose, string Frequency, string Duration, string? Route, string Instructions, int? Quantity, int SortOrder);
public sealed record PrescriptionDetails(Guid Id, string PrescriptionNumber, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, Guid? AppointmentId, Guid? ExaminationId, Guid? TreatmentId, PrescriptionStatus Status, string? Notes,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? IssuedAt, DateTimeOffset? CancelledAt, string? DocumentReference,
    Guid Version, IReadOnlyCollection<PrescriptionItemDetails> Items);
public sealed record PrescriptionListItem(Guid Id, string PrescriptionNumber, Guid PatientId, string PatientName, Guid DoctorProfileId,
    string DoctorName, PrescriptionStatus Status, DateTimeOffset CreatedAt, DateTimeOffset? IssuedAt);
public sealed record PrescriptionSearch(Guid? PatientId = null, Guid? DoctorProfileId = null, PrescriptionStatus? Status = null,
    DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);
public sealed record PrescriptionPatient(Guid Id, string Name, bool IsActive);
public sealed record PrescriptionDoctor(Guid Id, Guid UserId, string Name, string Specialization, string LicenseNumber, bool IsActive);
public sealed record PrescriptionAssociation(Guid Id, Guid PatientId, Guid DoctorProfileId);
public sealed record PrescriptionClinic(string Name, string? LogoReference, string Address, string City, string Country, string Phone);
public sealed record PrescriptionDocumentModel(PrescriptionClinic Clinic, string PrescriptionNumber, string PatientName, string DoctorName,
    string DoctorSpecialization, string DoctorLicense, DateTimeOffset IssuedAt, string? Notes, string VerificationReference,
    IReadOnlyCollection<PrescriptionItemDetails> Items);
public sealed record PrescriptionDocument(byte[] Content, string ContentType, string FileName);
public sealed class PrescriptionNotFoundException(string message) : Exception(message);
