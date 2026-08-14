using DentalClinic.Domain.Common;

namespace DentalClinic.Domain.Doctors;

public sealed class DoctorCompensation : TenantOwnedEntity
{
    private DoctorCompensation() { }
    public DoctorCompensation(Guid tenantId, Guid doctorProfileId, CompensationType compensationType,
        decimal? fixedAmount, decimal? percentage, DateOnly effectiveFrom, DateOnly? effectiveTo,
        DateTimeOffset createdAt)
    {
        if (tenantId == Guid.Empty || doctorProfileId == Guid.Empty) throw new ArgumentException("Tenant and doctor IDs are required.");
        TenantId = tenantId; DoctorProfileId = doctorProfileId;
        Apply(compensationType, fixedAmount, percentage, effectiveFrom, effectiveTo);
        CreatedAt = createdAt; UpdatedAt = createdAt;
    }
    public Guid DoctorProfileId { get; private set; }
    public CompensationType CompensationType { get; private set; }
    public decimal? FixedAmount { get; private set; }
    public decimal? Percentage { get; private set; }
    public DateOnly EffectiveFrom { get; private set; }
    public DateOnly? EffectiveTo { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public void Close(DateOnly effectiveTo, DateTimeOffset updatedAt)
    {
        if (effectiveTo < EffectiveFrom) throw new ArgumentException("Effective end cannot precede the start.");
        if (EffectiveTo.HasValue && effectiveTo > EffectiveTo.Value) throw new InvalidOperationException("A closed historical period cannot be extended.");
        EffectiveTo = effectiveTo; UpdatedAt = updatedAt;
    }

    private void Apply(CompensationType type, decimal? fixedAmount, decimal? percentage,
        DateOnly from, DateOnly? to)
    {
        if (!Enum.IsDefined(type)) throw new ArgumentOutOfRangeException(nameof(type));
        if (to.HasValue && to < from) throw new ArgumentException("Effective end cannot precede the start.");
        var hasFixed = fixedAmount is > 0;
        var hasPercentage = percentage is > 0 and <= 100;
        if (percentage is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(percentage));
        if ((type == CompensationType.FixedSalary && (!hasFixed || percentage.GetValueOrDefault() != 0)) ||
            (type == CompensationType.Percentage && (!hasPercentage || fixedAmount.GetValueOrDefault() != 0)) ||
            (type == CompensationType.FixedSalaryAndPercentage && (!hasFixed || !hasPercentage)))
            throw new ArgumentException("Compensation values do not match the selected type.");
        CompensationType = type;
        FixedAmount = hasFixed ? fixedAmount : null;
        Percentage = hasPercentage ? percentage : null;
        EffectiveFrom = from; EffectiveTo = to;
    }
}
