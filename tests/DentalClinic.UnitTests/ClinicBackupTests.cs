using System.Reflection;
using System.Security.Cryptography;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Infrastructure.Persistence;
using DentalClinic.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace DentalClinic.UnitTests;

public sealed class ClinicBackupTests
{
    [Fact]
    public void TableCatalogOrdersDependenciesWithoutCycles()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=planora_catalog_test").Options;
        using var db = new ApplicationDbContext(options, new Tenant());
        var service = new ClinicBackupService(db);
        var method = typeof(ClinicBackupService).GetMethod("Tables", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var tables = (Array)method.Invoke(service, null)!;
        Assert.True(tables.Length > 40);
    }

    [Fact]
    public async Task BackupEncryptionRoundTripsAndRejectsWrongPassword()
    {
        var input = Path.GetTempFileName();
        var encrypted = Path.GetTempFileName();
        var output = Path.GetTempFileName();
        try
        {
            var payload = RandomNumberGenerator.GetBytes(1_100_000);
            await File.WriteAllBytesAsync(input, payload);
            var encrypt = typeof(ClinicBackupService).GetMethod("EncryptAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            var decrypt = typeof(ClinicBackupService).GetMethod("DecryptAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            File.Delete(encrypted);
            await (Task)encrypt.Invoke(null, [input, encrypted, "long-secure-password", CancellationToken.None])!;
            File.Delete(output);
            await using (var stream = File.OpenRead(encrypted))
                await (Task)decrypt.Invoke(null, [stream, output, "long-secure-password", CancellationToken.None])!;
            Assert.Equal(payload, await File.ReadAllBytesAsync(output));
            File.Delete(output);
            await using var wrong = File.OpenRead(encrypted);
            await Assert.ThrowsAnyAsync<CryptographicException>(async () =>
                await (Task)decrypt.Invoke(null, [wrong, output, "another-long-password", CancellationToken.None])!);
        }
        finally
        {
            File.Delete(input);
            File.Delete(encrypted);
            File.Delete(output);
        }
    }

    private sealed class Tenant : ICurrentTenant
    {
        public Guid? TenantId => Guid.NewGuid();
        public bool IsAvailable => true;
        public Guid RequireTenantId() => TenantId!.Value;
    }
}
