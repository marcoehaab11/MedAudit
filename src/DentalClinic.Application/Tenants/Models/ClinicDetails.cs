using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants.Models;

public sealed record ClinicDetails(
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
    string? LogoReference,
    TenantStatus Status,
    string? AdminEmail,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
