using DentalClinic.Infrastructure.Security;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using StackExchange.Redis;
using DentalClinic.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace DentalClinic.IntegrationTests;

public sealed class RedisRequestLimitTests : IAsyncLifetime
{
    private readonly IContainer redis = new ContainerBuilder("redis:8-alpine")
        .WithPortBinding(6379, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(6379))
        .Build();
    private ConnectionMultiplexer connection = null!;

    public async Task InitializeAsync()
    {
        await redis.StartAsync();
        connection = await ConnectionMultiplexer.ConnectAsync($"{redis.Hostname}:{redis.GetMappedPublicPort(6379)},abortConnect=false");
    }

    public async Task DisposeAsync()
    {
        if (connection is not null) await connection.DisposeAsync();
        await redis.DisposeAsync();
    }

    [Fact]
    public async Task ConcurrentServersShareExactlyOneAllowanceAndRejectedCallsDoNotExtendIt()
    {
        var firstServer = new RedisRequestLimitStore(connection);
        await using var secondConnection = await ConnectionMultiplexer.ConnectAsync($"{redis.Hostname}:{redis.GetMappedPublicPort(6379)}");
        var secondServer = new RedisRequestLimitStore(secondConnection);
        var key = "test:{limits}:" + Guid.NewGuid();
        var quotas = new[] { new RequestQuota(key, 5, 30) };
        var results = await Task.WhenAll(Enumerable.Range(0, 80).Select(i =>
            (i % 2 == 0 ? firstServer : secondServer).TryAcquireAsync(quotas)));
        Assert.Equal(5, results.Count(x => x == 0));
        Assert.All(results.Where(x => x > 0), x => Assert.InRange(x, 1, 30));
        Assert.Equal("5", (await connection.GetDatabase().StringGetAsync(key)).ToString());
        var before = await connection.GetDatabase().KeyTimeToLiveAsync(key);
        Assert.True(await firstServer.TryAcquireAsync(quotas) > 0);
        var after = await connection.GetDatabase().KeyTimeToLiveAsync(key);
        Assert.True(after <= before);
    }

    [Fact]
    public async Task SessionReferencesRemainRevokedAcrossRedisClients()
    {
        var configuration = $"{redis.Hostname}:{redis.GetMappedPublicPort(6379)}";
        using var firstCache = new RedisCache(Options.Create(new RedisCacheOptions { Configuration = configuration }));
        using var secondCache = new RedisCache(Options.Create(new RedisCacheOptions { Configuration = configuration }));
        var first = new ServerSessionStore(firstCache);
        var second = new ServerSessionStore(secondCache);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("sub", Guid.NewGuid().ToString())], VerifiedSessionEvents.ClinicScheme)),
            new AuthenticationProperties { ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(5) }, VerifiedSessionEvents.ClinicScheme);
        var reference = await first.StoreAsync(ticket);
        Assert.NotNull(await second.RetrieveAsync(reference));
        await second.RemoveAsync(reference);
        Assert.Null(await first.RetrieveAsync(reference));
    }

    [Fact]
    public async Task CombinedQuotasRejectAtomicallyAndExpire()
    {
        var store = new RedisRequestLimitStore(connection);
        var prefix = "test:{limits}:" + Guid.NewGuid();
        RequestQuota[] quotas = [new(prefix + ":caller", 10, 1), new(prefix + ":account", 1, 1)];
        Assert.Equal(0, await store.TryAcquireAsync(quotas));
        Assert.Equal(1, await store.TryAcquireAsync(quotas));
        Assert.Equal("1", (await connection.GetDatabase().StringGetAsync(prefix + ":caller")).ToString());
        await Task.Delay(1200);
        Assert.Equal(0, await store.TryAcquireAsync(quotas));
        Assert.NotNull(await connection.GetDatabase().KeyTimeToLiveAsync(prefix + ":account"));
    }
}
