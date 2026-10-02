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
}
