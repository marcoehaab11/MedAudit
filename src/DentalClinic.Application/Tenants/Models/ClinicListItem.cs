using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants.Models;

public sealed record ClinicListItem(
    Guid Id,
    string Name,
    string Slug,
    TenantStatus Status,
    string Country,
    string City,
    string? AdminEmail,
    DateTimeOffset CreatedAt);
