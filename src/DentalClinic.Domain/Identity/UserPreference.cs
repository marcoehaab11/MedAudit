using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Identity;

public sealed class UserPreference : TenantOwnedEntity
{
    private UserPreference() { }

    public UserPreference(Guid tenantId, Guid userId)
    {
        if (tenantId == Guid.Empty || userId == Guid.Empty)
            throw new ArgumentException("Tenant and user IDs are required.");

        TenantId = tenantId;
        UserId = userId;
    }

    public Guid UserId { get; private set; }
    public string Language { get; private set; } = "en";
    public string Theme { get; private set; } = "Light";
    public string DateFormat { get; private set; } = "YYYY-MM-DD";
    public string TimeFormat { get; private set; } = "24h";
    public int StartOfWeek { get; private set; }
    public string DefaultCalendarView { get; private set; } = "timeGridWeek";

    public void Update(
        string language,
        string theme,
        string dateFormat,
        string timeFormat,
        int startOfWeek,
        string defaultCalendarView)
    {
        Language = string.IsNullOrWhiteSpace(language) ? "en" : language.Trim().ToLowerInvariant();
        Theme = theme.Trim() == "Dark" ? "Dark" : "Light";
        DateFormat = string.IsNullOrWhiteSpace(dateFormat) ? "YYYY-MM-DD" : dateFormat.Trim();
        TimeFormat = timeFormat.Trim() == "12h" ? "12h" : "24h";
        StartOfWeek = Math.Clamp(startOfWeek, 0, 6);
        DefaultCalendarView = string.IsNullOrWhiteSpace(defaultCalendarView) ? "timeGridWeek" : defaultCalendarView.Trim();
    }
}
