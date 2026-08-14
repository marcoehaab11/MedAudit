namespace DentalClinic.Infrastructure.Identity;

public static class AuthConstants
{
    public const string TenantIdClaim = "tenant_id";
    public const string PlatformAdminRole = "PlatformAdmin";
    public const string ClinicAdminRole = "ClinicAdmin";
    public const string ClinicAdminRoleNormalized = "CLINICADMIN";
    public const string DoctorRole = "Doctor";
    public const string ReceptionistRole = "Receptionist";
    public const string PlatformAdminPolicy = "PlatformAdminOnly";
    public const string TenantMemberPolicy = "TenantMember";
}
