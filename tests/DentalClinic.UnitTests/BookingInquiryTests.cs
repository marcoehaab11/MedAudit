using DentalClinic.Domain.Appointments;

namespace DentalClinic.UnitTests;

public sealed class BookingInquiryTests
{
    [Fact]
    public void CallbackRequestKeepsThePatientContactAndFollowUpTime()
    {
        var created = new DateTimeOffset(2026, 10, 2, 9, 0, 0, TimeSpan.Zero);
        var inquiry = new BookingInquiry(Guid.NewGuid(), "  Sara Ahmed  ", " 01000000000 ",
            "sara@example.com", "Interested in a consultation", created);

        Assert.Equal("Sara Ahmed", inquiry.PatientName);
        Assert.Equal("01000000000", inquiry.Phone);
        Assert.Null(inquiry.ContactedAt);

        inquiry.MarkContacted(created.AddHours(1));
        Assert.Equal(created.AddHours(1), inquiry.ContactedAt);
    }

    [Fact]
    public void CallbackRequestRequiresANameAndPhone()
    {
        Assert.Throws<ArgumentException>(() => new BookingInquiry(Guid.NewGuid(), " ", "123", null, null, DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => new BookingInquiry(Guid.NewGuid(), "Sara", " ", null, null, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void FollowUpTracksOwnerStatusAndNextAction()
    {
        var now = new DateTimeOffset(2026, 10, 2, 10, 0, 0, TimeSpan.Zero);
        var inquiry = new BookingInquiry(Guid.NewGuid(), "Sara", "01000000000", null, null, now, "qr");
        var staff = Guid.NewGuid();
        inquiry.UpdateFollowUp("Contacted", staff, "Call again tomorrow", now.AddDays(1), now);
        Assert.Equal("Contacted", inquiry.Status);
        Assert.Equal("qr", inquiry.Source);
        Assert.Equal(staff, inquiry.AssignedToUserId);
        Assert.Equal(now.AddDays(1), inquiry.FollowUpAt);
        Assert.Equal(now, inquiry.ContactedAt);
        Assert.Throws<ArgumentException>(() => inquiry.UpdateFollowUp("Invalid", null, null, null, now));
    }
}
