using DentalClinic.Domain.Tenancy;

namespace DentalClinic.Application.Tenants;

public sealed record ClinicSearchQuery(
    string? Search = null,
    TenantStatus? Status = null,
    int Page = 1,
    int PageSize = 20);
