namespace DentalClinic.Application.Identity;

public static class PermissionSetEvaluator
{
    public static IReadOnlySet<string> Resolve(IEnumerable<IEnumerable<string>> rolePermissions) =>
        new HashSet<string>(rolePermissions.SelectMany(x => x), StringComparer.Ordinal);

    public static bool HasPermission(IEnumerable<IEnumerable<string>> rolePermissions, string permission) =>
        Resolve(rolePermissions).Contains(permission);
}
