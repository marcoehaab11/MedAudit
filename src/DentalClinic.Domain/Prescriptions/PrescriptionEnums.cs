namespace DentalClinic.Domain.Prescriptions;

public enum PrescriptionStatus { Draft = 1, Issued = 2, Cancelled = 3 }
public enum MedicationForm { Tablet = 1, Capsule = 2, Syrup = 3, Cream = 4, Gel = 5, Mouthwash = 6, Injection = 7, Other = 8 }
public sealed class PrescriptionStateException(string message) : Exception(message);
public sealed class PrescriptionConcurrencyException(string message) : Exception(message);
