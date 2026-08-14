using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Testcontainers.PostgreSql;

namespace DentalClinic.IntegrationTests;

public sealed class PlatformMigrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public Task InitializeAsync() => _postgres.StartAsync();
    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    [Fact]
    public async Task Phase2MigrationPreservesExistingTenantStatus()
    {
        await using var context = CreateContext();
        var migrator = context.Database.GetService<IMigrator>();
        await migrator.MigrateAsync("20260814165740_InitialFoundation");
        var tenantId = Guid.NewGuid();
        const string name = "Legacy Clinic";
        const string slug = "legacy-clinic";
        await context.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO tenants (\"Id\", \"Name\", \"Slug\", \"IsActive\") VALUES ({tenantId}, {name}, {slug}, {true})");

        await migrator.MigrateAsync();
        context.ChangeTracker.Clear();

        var tenant = await context.Tenants.SingleAsync(x => x.Id == tenantId);
        Assert.Equal(TenantStatus.Active, tenant.Status);
        Assert.Equal("UTC", tenant.TimeZone);
        Assert.Equal("USD", tenant.Currency);
    }

    private ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        return new ApplicationDbContext(options, new NoTenant(), new PlatformWriteScope());
    }

    private sealed class NoTenant : ICurrentTenant
    {
        public Guid? TenantId => null;
        public bool IsAvailable => false;
        public Guid RequireTenantId() => throw new InvalidOperationException();
    }
}
