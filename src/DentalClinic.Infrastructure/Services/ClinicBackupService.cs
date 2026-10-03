using System.Buffers.Binary;
using System.Data;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using NpgsqlTypes;

namespace DentalClinic.Infrastructure.Services;

public sealed record BackupModule(string Id, string Name);
public sealed record BackupTable(string Name, string Module, long Rows, string Sha256);
public sealed record BackupClinicProfile(string Name, string Slug, string Phone, string Email, string Address,
    string City, string Country, string TimeZone, string Currency, string? LogoReference);
public sealed record BackupManifest(int FormatVersion, Guid TenantId, string ClinicName, DateTimeOffset CreatedAt,
    string Migration, string[] Modules, BackupTable[] Tables, BackupClinicProfile Profile);
public sealed record BackupFile(FileStream Stream, string Name);

public sealed class ClinicBackupService(ApplicationDbContext db)
{
    private const int ChunkSize = 1024 * 1024;
    private const long MaxEncryptedBytes = 2L * 1024 * 1024 * 1024;
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("PLANORA-BACKUP-1\n");
    private static readonly BackupModule[] ModuleCatalog =
    [
        new("patients", "Patients and medical history"), new("appointments", "Appointments and online booking"),
        new("clinical", "Dental records, treatments and prescriptions"), new("finance", "Finance"),
        new("operations", "Inventory, pharmacy, labs and insurance"), new("communications", "CRM and notifications"),
        new("settings", "Clinic settings"), new("accounts", "Users and permissions")
    ];

    public static IReadOnlyList<BackupModule> Modules => ModuleCatalog;

    public async Task<BackupFile> ExportAsync(Guid tenantId, IReadOnlyCollection<string> selectedModules, string password, CancellationToken token)
    {
        ValidatePassword(password);
        var tables = Tables();
        var modules = selectedModules.Contains("all", StringComparer.OrdinalIgnoreCase)
            ? ModuleCatalog.Select(x => x.Id).ToArray()
            : selectedModules.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.Ordinal).ToArray();
        if (modules.Length == 0 || modules.Any(x => ModuleCatalog.All(y => y.Id != x)))
            throw new ArgumentException("Choose at least one valid backup module.");
        var selected = tables.Where(x => modules.Contains(x.Module, StringComparer.OrdinalIgnoreCase)).ToArray();
        var profile = await db.Tenants.AsNoTracking().Where(x => x.Id == tenantId)
            .Select(x => new BackupClinicProfile(x.Name, x.Slug, x.Phone, x.Email, x.Address,
                x.City, x.Country, x.TimeZone, x.Currency, x.LogoReference))
            .SingleOrDefaultAsync(token) ?? throw new KeyNotFoundException("Clinic not found.");
        var migration = (await db.Database.GetAppliedMigrationsAsync(token)).LastOrDefault() ?? "none";
        var zipPath = TempPath();
        var encryptedPath = TempPath();
        try
        {
            await using (var zipFile = new FileStream(zipPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, ChunkSize, FileOptions.Asynchronous))
            {
                using var zip = new ZipArchive(zipFile, ZipArchiveMode.Create, leaveOpen: true);
                await db.Database.OpenConnectionAsync(token);
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
                var exported = new List<BackupTable>();
                foreach (var table in selected)
                {
                    var entry = zip.CreateEntry($"tables/{table.Name}.jsonl", CompressionLevel.Fastest);
                    await using var entryStream = entry.Open();
                    using var writer = new StreamWriter(entryStream, new UTF8Encoding(false), leaveOpen: true);
                    writer.NewLine = "\n";
                    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
                    long rows = 0;
                    var exportSql = table.Name == "AspNetUsers"
                        ? "SELECT to_jsonb(t)::text FROM \"AspNetUsers\" t WHERE EXISTS (SELECT 1 FROM clinic_users m WHERE m.\"IdentityUserId\" = t.\"Id\" AND m.\"TenantId\" = @tenant)"
                        : $"SELECT to_jsonb(t)::text FROM {Quote(table.Name)} t WHERE \"TenantId\" = @tenant";
                    await using var command = new NpgsqlCommand(exportSql, (NpgsqlConnection)db.Database.GetDbConnection(), (NpgsqlTransaction)transaction.GetDbTransaction());
                    command.Parameters.AddWithValue("tenant", tenantId);
                    await using (var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess, token))
                    {
                        while (await reader.ReadAsync(token))
                        {
                            var line = reader.GetString(0);
                            await writer.WriteLineAsync(line.AsMemory(), token);
                            hash.AppendData(Encoding.UTF8.GetBytes(line + "\n"));
                            rows++;
                        }
                    }
                    await writer.FlushAsync(token);
                    exported.Add(new BackupTable(table.Name, table.Module, rows, Convert.ToHexString(hash.GetHashAndReset())));
                }
                var manifest = new BackupManifest(1, tenantId, profile.Name, DateTimeOffset.UtcNow, migration, modules, exported.ToArray(), profile);
                var manifestEntry = zip.CreateEntry("manifest.json", CompressionLevel.Fastest);
                await using (var stream = manifestEntry.Open()) await JsonSerializer.SerializeAsync(stream, manifest, cancellationToken: token);
                await transaction.CommitAsync(token);
            }
            await EncryptAsync(zipPath, encryptedPath, password, token);
            var result = new FileStream(encryptedPath, FileMode.Open, FileAccess.Read, FileShare.Read, ChunkSize, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
            return new BackupFile(result, $"planora-{tenantId:N}-{DateTimeOffset.UtcNow:yyyyMMdd-HHmm}.plnbak");
        }
        catch { if (File.Exists(encryptedPath)) File.Delete(encryptedPath); throw; }
        finally { if (File.Exists(zipPath)) File.Delete(zipPath); }
    }

    public async Task<BackupManifest> InspectAsync(Stream encrypted, string password, Guid targetTenantId, CancellationToken token)
    {
        var zipPath = TempPath();
        try
        {
            await DecryptAsync(encrypted, zipPath, password, token);
            using var zip = ZipFile.OpenRead(zipPath);
            return await ValidateArchiveAsync(zip, targetTenantId, token);
        }
        finally { if (File.Exists(zipPath)) File.Delete(zipPath); }
    }

    public async Task<BackupManifest> RestoreAsync(Stream encrypted, string password, Guid targetTenantId, CancellationToken token)
    {
        var zipPath = TempPath();
        try
        {
            await DecryptAsync(encrypted, zipPath, password, token);
            using var zip = ZipFile.OpenRead(zipPath);
            var manifest = await ValidateArchiveAsync(zip, targetTenantId, token);
            var allTables = Tables();
            var selected = allTables.Where(x => manifest.Tables.Any(y => y.Name == x.Name)).ToArray();
            if (!await db.Tenants.AnyAsync(x => x.Id == targetTenantId, token)) throw new KeyNotFoundException("Target clinic not found.");
            await db.Database.OpenConnectionAsync(token);
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
            var connection = (NpgsqlConnection)db.Database.GetDbConnection();
            var sqlTransaction = (NpgsqlTransaction)transaction.GetDbTransaction();
            var selectedNames = selected.Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
            foreach (var dependent in allTables.Where(x => !selectedNames.Contains(x.Name) && x.Parents.Any(selectedNames.Contains)))
            {
                await using var check = new NpgsqlCommand($"SELECT EXISTS(SELECT 1 FROM {Quote(dependent.Name)} WHERE \"TenantId\" = @tenant)", connection, sqlTransaction);
                check.Parameters.AddWithValue("tenant", targetTenantId);
                if ((bool)(await check.ExecuteScalarAsync(token))!)
                    throw new InvalidOperationException($"This partial restore also needs the {dependent.Module} module because it references {string.Join(", ", dependent.Parents.Where(selectedNames.Contains))}.");
            }
            foreach (var table in selected.Reverse().Where(x => x.Name != "AspNetUsers"))
            {
                await using var delete = new NpgsqlCommand($"DELETE FROM {Quote(table.Name)} WHERE \"TenantId\" = @tenant", connection, sqlTransaction);
                delete.Parameters.AddWithValue("tenant", targetTenantId);
                await delete.ExecuteNonQueryAsync(token);
            }
            foreach (var table in selected)
            {
                var entry = zip.GetEntry($"tables/{table.Name}.jsonl")!;
                await using var stream = entry.Open();
                using var reader = new StreamReader(stream, Encoding.UTF8);
                if (table.Name == "financial_categories")
                {
                    var pending = new Dictionary<Guid, (Guid? ParentId, string Line)>();
                    string? categoryLine;
                    while ((categoryLine = await reader.ReadLineAsync(token)) is not null)
                    {
                        using var json = JsonDocument.Parse(categoryLine);
                        var id = json.RootElement.GetProperty("Id").GetGuid();
                        var parent = json.RootElement.TryGetProperty("ParentId", out var value) && value.ValueKind != JsonValueKind.Null ? value.GetGuid() : (Guid?)null;
                        pending.Add(id, (parent, categoryLine));
                    }
                    while (pending.Count > 0)
                    {
                        var ready = pending.Where(x => !x.Value.ParentId.HasValue || !pending.ContainsKey(x.Value.ParentId.Value)).Select(x => x.Key).ToArray();
                        if (ready.Length == 0) throw new InvalidDataException("Financial category hierarchy contains a cycle.");
                        foreach (var id in ready)
                        {
                            await InsertRowAsync(connection, sqlTransaction, table.Name, pending[id].Line, targetTenantId, token);
                            pending.Remove(id);
                        }
                    }
                }
                else { string? line; while ((line = await reader.ReadLineAsync(token)) is not null) await InsertRowAsync(connection, sqlTransaction, table.Name, line, targetTenantId, token); }
            }
            if (manifest.Modules.Contains("settings", StringComparer.Ordinal))
            {
                await using var update = new NpgsqlCommand("""
                    UPDATE tenants SET "Name"=@name, "Slug"=@slug, "Phone"=@phone, "Email"=@email,
                        "Address"=@address, "City"=@city, "Country"=@country, "TimeZone"=@timeZone,
                        "Currency"=@currency, "LogoReference"=@logo, "UpdatedAt"=now()
                    WHERE "Id"=@tenant
                    """, connection, sqlTransaction);
                update.Parameters.AddWithValue("name", manifest.Profile.Name);
                update.Parameters.AddWithValue("slug", manifest.Profile.Slug);
                update.Parameters.AddWithValue("phone", manifest.Profile.Phone);
                update.Parameters.AddWithValue("email", manifest.Profile.Email);
                update.Parameters.AddWithValue("address", manifest.Profile.Address);
                update.Parameters.AddWithValue("city", manifest.Profile.City);
                update.Parameters.AddWithValue("country", manifest.Profile.Country);
                update.Parameters.AddWithValue("timeZone", manifest.Profile.TimeZone);
                update.Parameters.AddWithValue("currency", manifest.Profile.Currency);
                update.Parameters.Add("logo", NpgsqlDbType.Varchar).Value = (object?)manifest.Profile.LogoReference ?? DBNull.Value;
                update.Parameters.AddWithValue("tenant", targetTenantId);
                await update.ExecuteNonQueryAsync(token);
            }
            await transaction.CommitAsync(token);
            return manifest;
        }
        finally { if (File.Exists(zipPath)) File.Delete(zipPath); }
    }

    private async Task<BackupManifest> ValidateArchiveAsync(ZipArchive zip, Guid targetTenantId, CancellationToken token)
    {
        var entry = zip.GetEntry("manifest.json") ?? throw new InvalidDataException("Backup manifest is missing.");
        await using var stream = entry.Open();
        var manifest = await JsonSerializer.DeserializeAsync<BackupManifest>(stream, cancellationToken: token)
            ?? throw new InvalidDataException("Backup manifest is invalid.");
        if (manifest.FormatVersion != 1 || manifest.TenantId != targetTenantId || manifest.Profile is null)
            throw new InvalidDataException("Backup format or clinic does not match.");
        var migration = (await db.Database.GetAppliedMigrationsAsync(token)).LastOrDefault() ?? "none";
        if (manifest.Migration != migration) throw new InvalidDataException("Backup database version differs from the current version.");
        var catalog = Tables().ToDictionary(x => x.Name, StringComparer.Ordinal);
        if (manifest.Modules.Length == 0 || manifest.Modules.Distinct(StringComparer.Ordinal).Count() != manifest.Modules.Length ||
            manifest.Modules.Any(x => ModuleCatalog.All(y => y.Id != x)) ||
            manifest.Tables.Length == 0 || manifest.Tables.Select(x => x.Name).Distinct(StringComparer.Ordinal).Count() != manifest.Tables.Length)
            throw new InvalidDataException("Backup table list is invalid.");
        var expectedNames = catalog.Values.Where(x => manifest.Modules.Contains(x.Module, StringComparer.Ordinal)).Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
        if (!expectedNames.SetEquals(manifest.Tables.Select(x => x.Name)))
            throw new InvalidDataException("Backup is missing one or more tables for its selected modules.");
        long totalBytes = 0;
        var membershipIdentityIds = new HashSet<Guid>();
        var archivedIdentityIds = new HashSet<Guid>();
        if (manifest.Modules.Contains("accounts", StringComparer.Ordinal))
        {
            var membershipEntry = zip.GetEntry("tables/clinic_users.jsonl") ?? throw new InvalidDataException("Clinic memberships are missing.");
            if (membershipEntry.Length > MaxEncryptedBytes) throw new InvalidDataException("Clinic memberships are too large.");
            await using var membershipStream = membershipEntry.Open();
            using var membershipReader = new StreamReader(membershipStream, Encoding.UTF8);
            string? membershipLine;
            while ((membershipLine = await membershipReader.ReadLineAsync(token)) is not null)
            {
                using var membership = JsonDocument.Parse(membershipLine);
                if (membership.RootElement.GetProperty("TenantId").GetGuid() != targetTenantId)
                    throw new InvalidDataException("Backup contains a membership from another clinic.");
                membershipIdentityIds.Add(membership.RootElement.GetProperty("IdentityUserId").GetGuid());
            }
        }
        foreach (var table in manifest.Tables)
        {
            if (!catalog.TryGetValue(table.Name, out var expected) || expected.Module != table.Module || !manifest.Modules.Contains(table.Module))
                throw new InvalidDataException("Backup contains an unexpected table or module.");
            var data = zip.GetEntry($"tables/{table.Name}.jsonl") ?? throw new InvalidDataException($"Missing table {table.Name}.");
            totalBytes += data.Length;
            if (data.Length > MaxEncryptedBytes || totalBytes > MaxEncryptedBytes || table.Rows < 0 || table.Sha256.Length != 64)
                throw new InvalidDataException("Backup table is too large or invalid.");
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            long rows = 0;
            await using var tableStream = data.Open();
            using var reader = new StreamReader(tableStream, Encoding.UTF8);
            string? line;
            while ((line = await reader.ReadLineAsync(token)) is not null)
            {
                hash.AppendData(Encoding.UTF8.GetBytes(line + "\n"));
                using var json = JsonDocument.Parse(line);
                if (table.Name != "AspNetUsers" &&
                    (!json.RootElement.TryGetProperty("TenantId", out var tenant) || tenant.GetGuid() != targetTenantId))
                    throw new InvalidDataException("Backup contains data from another clinic.");
                if (table.Name == "AspNetUsers" &&
                    (!json.RootElement.TryGetProperty("IsPlatformAdmin", out var admin) || admin.GetBoolean() ||
                     !membershipIdentityIds.Contains(json.RootElement.GetProperty("Id").GetGuid())))
                    throw new InvalidDataException("A clinic backup cannot contain platform administrator accounts.");
                if (table.Name == "AspNetUsers") archivedIdentityIds.Add(json.RootElement.GetProperty("Id").GetGuid());
                rows++;
            }
            if (rows != table.Rows || !CryptographicOperations.FixedTimeEquals(hash.GetHashAndReset(), Convert.FromHexString(table.Sha256)))
                throw new InvalidDataException($"Backup table {table.Name} failed integrity verification.");
        }
        if (manifest.Modules.Contains("accounts", StringComparer.Ordinal) && !archivedIdentityIds.SetEquals(membershipIdentityIds))
            throw new InvalidDataException("Backup identities do not match clinic memberships.");
        return manifest;
    }

    private sealed record TableInfo(string Name, string Module, string[] Parents);

    private static async Task InsertRowAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, string table, string line, Guid tenantId, CancellationToken token)
    {
        var sql = table == "AspNetUsers"
            ? $"""
                INSERT INTO {Quote(table)} SELECT * FROM jsonb_populate_record(NULL::{Quote(table)}, jsonb_set(@row::jsonb, ARRAY['TenantId'], to_jsonb(@tenant::uuid))) AS account
                WHERE account."IsPlatformAdmin" = FALSE
                ON CONFLICT ("Id") DO UPDATE SET
                    "AccessFailedCount" = EXCLUDED."AccessFailedCount",
                    "ConcurrencyStamp" = EXCLUDED."ConcurrencyStamp",
                    "Email" = EXCLUDED."Email",
                    "EmailConfirmed" = EXCLUDED."EmailConfirmed",
                    "IsPlatformAdmin" = EXCLUDED."IsPlatformAdmin",
                    "LockoutEnabled" = EXCLUDED."LockoutEnabled",
                    "LockoutEnd" = EXCLUDED."LockoutEnd",
                    "NormalizedEmail" = EXCLUDED."NormalizedEmail",
                    "NormalizedUserName" = EXCLUDED."NormalizedUserName",
                    "PasswordHash" = EXCLUDED."PasswordHash",
                    "PhoneNumber" = EXCLUDED."PhoneNumber",
                    "PhoneNumberConfirmed" = EXCLUDED."PhoneNumberConfirmed",
                    "SecurityStamp" = EXCLUDED."SecurityStamp",
                    "TwoFactorEnabled" = EXCLUDED."TwoFactorEnabled",
                    "UserName" = EXCLUDED."UserName"
                WHERE EXCLUDED."IsPlatformAdmin" = FALSE AND NOT EXISTS (
                    SELECT 1 FROM clinic_users member
                    WHERE member."IdentityUserId" = EXCLUDED."Id" AND member."TenantId" <> @tenant)
                """
            : $"INSERT INTO {Quote(table)} SELECT * FROM jsonb_populate_record(NULL::{Quote(table)}, @row::jsonb)";
        await using var insert = new NpgsqlCommand(sql, connection, transaction);
        insert.Parameters.Add("row", NpgsqlDbType.Jsonb).Value = line;
        if (table == "AspNetUsers") insert.Parameters.AddWithValue("tenant", tenantId);
        if (await insert.ExecuteNonQueryAsync(token) != 1)
        {
            if (table == "AspNetUsers")
            {
                using var json = JsonDocument.Parse(line);
                await using var check = new NpgsqlCommand("""
                    SELECT EXISTS (
                        SELECT 1 FROM "AspNetUsers" identity
                        WHERE identity."Id" = @id AND identity."IsPlatformAdmin" = FALSE
                          AND EXISTS (SELECT 1 FROM clinic_users member WHERE member."IdentityUserId" = @id AND member."TenantId" <> @tenant))
                    """, connection, transaction);
                check.Parameters.AddWithValue("id", json.RootElement.GetProperty("Id").GetGuid());
                check.Parameters.AddWithValue("tenant", tenantId);
                if ((bool)(await check.ExecuteScalarAsync(token))!) return;
            }
            throw new InvalidDataException("Backup user conflicts with another account or a platform administrator.");
        }
    }

    private TableInfo[] Tables()
    {
        var entities = db.Model.GetEntityTypes().Where(x => x.GetTableName() is not null && x.FindProperty("TenantId") is not null)
            .GroupBy(x => x.GetTableName()!, StringComparer.Ordinal).Select(x => x.First()).ToArray();
        var byName = entities.ToDictionary(x => x.GetTableName()!, StringComparer.Ordinal);
        var infos = entities.Select(x => new TableInfo(x.GetTableName()!, ModuleFor(x), x.GetForeignKeys()
            .Select(f => f.PrincipalEntityType.GetTableName()).Where(n => n is not null && n != x.GetTableName() && byName.ContainsKey(n))
            .Select(n => n!).Distinct(StringComparer.Ordinal).ToArray())).ToArray();
        var sorted = new List<TableInfo>();
        var remaining = infos.ToDictionary(x => x.Name, StringComparer.Ordinal);
        while (remaining.Count > 0)
        {
            var ready = remaining.Values.Where(x => x.Parents.All(p => !remaining.ContainsKey(p))).OrderBy(x => x.Name, StringComparer.Ordinal).ToArray();
            if (ready.Length == 0) throw new InvalidOperationException("Backup table dependencies contain a cycle.");
            foreach (var table in ready) { sorted.Add(table); remaining.Remove(table.Name); }
        }
        return sorted.ToArray();
    }

    private static string ModuleFor(IEntityType entity)
    {
        if (entity.GetTableName() == "AspNetUsers") return "accounts";
        var name = entity.ClrType.Namespace ?? "";
        if (name.Contains("Patients", StringComparison.Ordinal)) return "patients";
        if (name.Contains("Appointments", StringComparison.Ordinal)) return "appointments";
        if (name.Contains("Dental", StringComparison.Ordinal) || name.Contains("Treatments", StringComparison.Ordinal) || name.Contains("Prescriptions", StringComparison.Ordinal)) return "clinical";
        if (name.Contains("Finance", StringComparison.Ordinal)) return "finance";
        if (name.Contains("Inventory", StringComparison.Ordinal) || name.Contains("Pharmacy", StringComparison.Ordinal) || name.Contains("ClinicBusiness", StringComparison.Ordinal)) return "operations";
        if (name.Contains("Crm", StringComparison.Ordinal) || name.Contains("Notifications", StringComparison.Ordinal)) return "communications";
        if (name.Contains("Tenancy", StringComparison.Ordinal)) return "settings";
        return "accounts";
    }

    private static string Quote(string identifier) => $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    private static string TempPath() => Path.Combine(Path.GetTempPath(), $"planora-{Guid.NewGuid():N}.tmp");
    private static void ValidatePassword(string password)
    { if (string.IsNullOrWhiteSpace(password) || password.Length < 12) throw new ArgumentException("Backup password must have at least 12 characters."); }

    private static async Task EncryptAsync(string sourcePath, string destinationPath, string password, CancellationToken token)
    {
        await using var input = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read, ChunkSize, FileOptions.Asynchronous);
        await using var output = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, ChunkSize, FileOptions.Asynchronous);
        var salt = RandomNumberGenerator.GetBytes(16);
        await output.WriteAsync(Magic, token);
        await output.WriteAsync(salt, token);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 300_000, HashAlgorithmName.SHA256, 32);
        using var aes = new AesGcm(key, 16);
        var plain = new byte[ChunkSize];
        var cipher = new byte[ChunkSize];
        var count = 0;
        int read;
        while ((read = await input.ReadAsync(plain, token)) > 0)
        {
            var nonce = RandomNumberGenerator.GetBytes(12);
            var tag = new byte[16];
            var index = new byte[4]; BinaryPrimitives.WriteInt32LittleEndian(index, count++);
            aes.Encrypt(nonce, plain.AsSpan(0, read), cipher.AsSpan(0, read), tag, index);
            var length = new byte[4]; BinaryPrimitives.WriteInt32LittleEndian(length, read);
            await output.WriteAsync(length, token);
            await output.WriteAsync(nonce, token);
            await output.WriteAsync(cipher.AsMemory(0, read), token);
            await output.WriteAsync(tag, token);
        }
        await output.WriteAsync(new byte[4], token);
        CryptographicOperations.ZeroMemory(key);
    }

    private static async Task DecryptAsync(Stream encrypted, string destinationPath, string password, CancellationToken token)
    {
        ValidatePassword(password);
        var header = new byte[Magic.Length];
        await encrypted.ReadExactlyAsync(header, token);
        if (!header.AsSpan().SequenceEqual(Magic)) throw new InvalidDataException("This is not a Planora backup.");
        var salt = new byte[16]; await encrypted.ReadExactlyAsync(salt, token);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 300_000, HashAlgorithmName.SHA256, 32);
        try
        {
            using var aes = new AesGcm(key, 16);
            await using var output = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, ChunkSize, FileOptions.Asynchronous);
            var total = 0L; var indexValue = 0;
            while (true)
            {
                var length = new byte[4]; await encrypted.ReadExactlyAsync(length, token);
                var size = BinaryPrimitives.ReadInt32LittleEndian(length);
                if (size == 0) break;
                if (size < 0 || size > ChunkSize || total + size > MaxEncryptedBytes) throw new InvalidDataException("Backup is too large or invalid.");
                var nonce = new byte[12]; await encrypted.ReadExactlyAsync(nonce, token);
                var cipher = new byte[size]; await encrypted.ReadExactlyAsync(cipher, token);
                var tag = new byte[16]; await encrypted.ReadExactlyAsync(tag, token);
                var plain = new byte[size]; var index = new byte[4]; BinaryPrimitives.WriteInt32LittleEndian(index, indexValue++);
                aes.Decrypt(nonce, cipher, tag, plain, index);
                await output.WriteAsync(plain, token);
                total += size;
            }
            if (await encrypted.ReadAsync(new byte[1], token) != 0) throw new InvalidDataException("Backup has trailing data.");
        }
        finally { CryptographicOperations.ZeroMemory(key); }
    }
}
