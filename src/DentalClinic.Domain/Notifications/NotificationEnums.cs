namespace DentalClinic.Domain.Notifications;

public enum NotificationChannel
{
    Email = 1,
    Sms = 2,
    WhatsApp = 3,
    InApp = 4
}

public enum NotificationStatus
{
    Pending = 1,
    Processing = 2,
    Sent = 3,
    Failed = 4,
    Cancelled = 5
}

public enum RecipientType
{
    Patient = 1,
    Doctor = 2,
    Staff = 3
}

public enum OutboxStatus
{
    Pending = 1,
    Processing = 2,
    Processed = 3,
    Failed = 4
}
