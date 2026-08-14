using Microsoft.AspNetCore.Identity;

namespace DentalClinic.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public Guid? TenantId { get; set; }
    public bool IsPlatformAdmin { get; set; }
}
