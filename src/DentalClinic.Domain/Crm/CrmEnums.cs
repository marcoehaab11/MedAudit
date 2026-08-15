namespace DentalClinic.Domain.Crm;

public enum FollowUpType
{
    NewPatient = 1,
    AppointmentReminder = 2,
    MissedAppointment = 3,
    TreatmentFollowUp = 4,
    TreatmentPlanFollowUp = 5,
    PostTreatment = 6,
    PrescriptionFollowUp = 7,
    General = 8
}

public enum FollowUpStatus { Pending = 1, InProgress = 2, Completed = 3, Cancelled = 4 }
public enum CommunicationType { Call = 1, WhatsApp = 2, Sms = 3, Email = 4, Other = 5 }
public enum CommunicationDirection { Outbound = 1, Inbound = 2 }

public sealed class FollowUpConcurrencyException(string message) : Exception(message);
public sealed class FollowUpStateException(string message) : Exception(message);
