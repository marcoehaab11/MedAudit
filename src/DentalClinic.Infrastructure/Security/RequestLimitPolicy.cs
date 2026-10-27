using Microsoft.AspNetCore.Http;

namespace DentalClinic.Infrastructure.Security;

public sealed record RequestLimitPolicy(string Name, int Limit, int WindowSeconds, bool ReadAccount = false,
    int AccountLimit = 0)
{
    public static RequestLimitPolicy Select(HttpRequest request, bool administrator)
    {
        // Never use IDs, slugs, query strings or supplied tokens as bucket names.
        var path = (request.Path.Value ?? "/").TrimEnd('/').ToLowerInvariant();
        var read = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method);
        if (read) return ReadPolicy(path, administrator);

        if (path is "/api/auth/login" or "/account/login") return new("login", 30, 900, true, 10);
        if (path is "/api/auth/forgot-password" or "/api/public/clinics/resend")
            return new(path.EndsWith("resend", StringComparison.Ordinal) ? "resend-email" : "reset-email", 10, 3600, true, 3);
        if (path == "/api/public/clinics/register") return new("signup", 5, 3600);
        if (path is "/api/public/clinics/confirm" or "/api/auth/reset-password" or "/api/auth/invitations/accept")
            return new(path, 10, 900);
        if (path == "/api/auth/invitations/inspect") return new("invitation-inspect", 30, 900);
        if (path == "/api/auth/switch-clinic") return new("switch-clinic", 30, 900);
        if (path.StartsWith("/api/public/", StringComparison.Ordinal))
        {
            if (path.EndsWith("/visits", StringComparison.Ordinal)) return new("public-visits", 30, 60);
            if (path.EndsWith("/bookings", StringComparison.Ordinal)) return new("public-booking", 5, 3600);
            if (path.EndsWith("/inquiries", StringComparison.Ordinal)) return new("public-inquiry", 5, 3600);
            if (path.StartsWith("/api/public/bookings/manage/", StringComparison.Ordinal))
            {
                var action = path.Split('/')[^1];
                return new("manage-" + (action is "confirm" or "cancel" or "reschedule" ? action : "other"), 10, 3600);
            }
            return new("public-write", 10, 900);
        }

        if (administrator)
        {
            // Match Razor Pages: repeated handler parameters use the first value.
            var handler = request.Query["handler"].FirstOrDefault() ?? string.Empty;
            if (path == "/admin/email" && (handler.Equals("Test", StringComparison.OrdinalIgnoreCase) || handler.Equals("Retry", StringComparison.OrdinalIgnoreCase)))
                return new("admin-email", 5, 3600);
            if (handler.Equals("Backup", StringComparison.OrdinalIgnoreCase) || handler.Equals("PreviewRestore", StringComparison.OrdinalIgnoreCase) || handler.Equals("Restore", StringComparison.OrdinalIgnoreCase))
                return new("bulk-files", 5, 900);
            if (path == "/admin/clinics/create") return new("account-create", 10, 3600);
            return new("admin-write", 30, 3600);
        }
        if (path.StartsWith("/api/backups/", StringComparison.Ordinal)) return new("bulk-files", 5, 900);
        if (path == "/api/users" || path == "/api/users/invitations") return new("account-create", 10, 3600);
        if (request.Path.StartsWithSegments("/api/users") || request.Path.StartsWithSegments("/api/roles") || request.Path.StartsWithSegments("/api/branches"))
            return new("access-write", 30, 3600);
        return new("write", 120, 60);
    }

    private static RequestLimitPolicy ReadPolicy(string path, bool administrator)
    {
        if (path.StartsWith("/api/public/", StringComparison.Ordinal)) return new("public-read", 120, 60);
        if (path.StartsWith("/api/reports/export/", StringComparison.Ordinal)) return new("bulk-files", 5, 900);
        if (path.StartsWith("/api/reports", StringComparison.Ordinal) ||
            (path.StartsWith("/api/prescriptions/", StringComparison.Ordinal) &&
             (path.EndsWith("/document", StringComparison.Ordinal) || path.EndsWith("/print", StringComparison.Ordinal) || path.EndsWith("/qr", StringComparison.Ordinal))))
            return new("documents", 30, 60);
        return new(administrator ? "admin-read" : "read", 300, 60);
    }
}
