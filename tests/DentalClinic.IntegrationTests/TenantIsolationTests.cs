using DentalClinic.Application.Common.Exceptions;
using DentalClinic.Application.Common.Interfaces;
using DentalClinic.Domain.Tenancy;
using DentalClinic.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace DentalClinic.IntegrationTests;

public sealed class TenantIsolationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await using var context = CreateContext(Guid.NewGuid());
        await context.Database.EnsureCreatedAsync();
    }

    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    [Fact]
    public async Task QueryFilterPreventsCrossTenantReads()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await AddConfiguration(tenantA, "en");
        await AddConfiguration(tenantB, "ar");

        await using var contextA = CreateContext(tenantA);
        var visible = await contextA.TenantConfigurations.AsNoTracking().ToListAsync();

        var configuration = Assert.Single(visible);
        Assert.Equal(tenantA, configuration.TenantId);
        Assert.Equal("en", configuration.Culture);
    }

    [Fact]
    public async Task SaveChangesAssignsCurrentTenantToNewEntities()
    {
        var tenantId = Guid.NewGuid();
        var configuration = new TenantConfiguration("en", "UTC", "USD");
        await using var context = CreateContext(tenantId);

        context.TenantConfigurations.Add(configuration);
        await context.SaveChangesAsync();

        Assert.Equal(tenantId, configuration.TenantId);
    }

    [Fact]
    public async Task SaveChangesRejectsCrossTenantUpdates()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        await AddConfiguration(tenantB, "ar");

        await using var contextA = CreateContext(tenantA);
        var tenantBRecord = await contextA.TenantConfigurations
            .IgnoreQueryFilters()
            .SingleAsync(x => x.TenantId == tenantB);
        contextA.Entry(tenantBRecord).State = EntityState.Modified;

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => contextA.SaveChangesAsync());
    }

    private async Task AddConfiguration(Guid tenantId, string culture)
    {
        await using var context = CreateContext(tenantId);
        context.TenantConfigurations.Add(new TenantConfiguration(culture, "UTC", "USD"));
        await context.SaveChangesAsync();
    }

    private ApplicationDbContext CreateContext(Guid tenantId)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        return new ApplicationDbContext(options, new TestTenant(tenantId));
    }

    private sealed class TestTenant(Guid tenantId) : ICurrentTenant
    {
        public Guid? TenantId { get; } = tenantId;
        public bool IsAvailable => true;
        public Guid RequireTenantId() => tenantId;
    }
}
