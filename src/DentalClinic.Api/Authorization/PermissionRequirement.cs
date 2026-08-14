using Microsoft.AspNetCore.Authorization;

namespace DentalClinic.Api.Authorization;

internal sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
