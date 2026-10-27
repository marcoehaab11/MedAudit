using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace DentalClinic.Infrastructure.Persistence;

public static class DatabaseSecurityBootstrap
{
    // Invoked by the one-shot migration container only. The web/worker containers
    // never receive the owner password and never run migrations.
    public static async Task MigrateAsync(IServiceProvider services, IConfiguration configuration)
    {
        foreach (var key in new[] { "DatabaseSecurity:AppPassword", "DatabaseSecurity:WorkerPassword" })
            if (string.IsNullOrWhiteSpace(configuration[key]) || configuration[key]!.Length < 32)
                throw new InvalidOperationException($"{key} must contain a generated password of at least 32 characters before applying migrations.");
        await DatabaseSeeder.SeedAsync(services);
        var connectionString = configuration.GetConnectionString("Postgres")!;
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        foreach (var (login, passwordKey, worker) in new[]
        {
            ("meddentist_app", "DatabaseSecurity:AppPassword", false),
            ("meddentist_jobs", "DatabaseSecurity:WorkerPassword", true)
        })
        {
            var password = configuration[passwordKey];
            if (string.IsNullOrWhiteSpace(password) || password.Length < 32)
                throw new InvalidOperationException($"{passwordKey} must contain a generated password of at least 32 characters.");
            await using var format = new NpgsqlCommand("""
                SELECT format(CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = @login)
                  THEN 'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD %L'
                  ELSE 'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD %L' END,
                  @login, @password)
                """, connection);
            format.Parameters.AddWithValue("login", login);
            format.Parameters.AddWithValue("password", password);
            var sql = (string)(await format.ExecuteScalarAsync())!;
            await using var create = new NpgsqlCommand(sql, connection);
            await create.ExecuteNonQueryAsync();
            await using var grant = new NpgsqlCommand($"GRANT meddentist_runtime TO {login};" +
                (worker ? $"GRANT meddentist_worker TO {login};" : ""), connection);
            await grant.ExecuteNonQueryAsync();
        }
    }

    public static async Task VerifyRuntimeAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
              AND pg_has_role(current_user, 'meddentist_runtime', 'member')
              AND NOT EXISTS (SELECT 1 FROM pg_roles elevated WHERE
                  (elevated.rolsuper OR elevated.rolbypassrls OR elevated.rolcreaterole)
                  AND pg_has_role(current_user, elevated.oid, 'member'))
              AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  JOIN pg_roles owner_role ON owner_role.oid = p.proowner
                  WHERE n.nspname = 'clinic_security' AND p.prosecdef
                  AND NOT (owner_role.rolsuper OR owner_role.rolbypassrls))
              AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
                  AND c.relname <> '__EFMigrationsHistory'
                  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_has_role(current_user, c.relowner, 'member')))
            FROM pg_roles r WHERE r.rolname = current_user
            """;
        if (await command.ExecuteScalarAsync() is not true)
            throw new InvalidOperationException("Database isolation is not ready: run the migration job and use a restricted runtime login. The application will not start with a database-owner/superuser connection or an unprotected table.");
    }
}
