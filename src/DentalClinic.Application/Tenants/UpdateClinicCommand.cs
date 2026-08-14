namespace DentalClinic.Application.Tenants;

public sealed record UpdateClinicCommand(
    Guid Id,
    string Name,
    string Slug,
    string Phone,
    string Email,
    string Address,
    string City,
    string Country,
    string TimeZone,
    string Currency,
    string? LogoReference);
