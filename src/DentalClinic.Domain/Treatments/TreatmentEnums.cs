namespace DentalClinic.Domain.Treatments;

public enum TreatmentType { Filling = 1, Extraction = 2, Implant = 3, RootCanal = 4, Crown = 5, Other = 6 }
public enum TreatmentPlanStatus { Draft = 1, Proposed = 2, Accepted = 3, Rejected = 4, InProgress = 5, Completed = 6, Cancelled = 7 }
public enum TreatmentStatus { Planned = 1, Scheduled = 2, InProgress = 3, Completed = 4, Cancelled = 5 }

public sealed class TreatmentConcurrencyException(string message) : Exception(message);
public sealed class TreatmentStateException(string message) : Exception(message);
