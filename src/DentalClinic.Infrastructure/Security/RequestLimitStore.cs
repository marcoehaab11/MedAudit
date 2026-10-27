using StackExchange.Redis;

namespace DentalClinic.Infrastructure.Security;

public sealed record RequestQuota(string Key, int Limit, int WindowSeconds);

public interface IRequestLimitStore
{
    Task<int> TryAcquireAsync(IReadOnlyList<RequestQuota> quotas);
}

public sealed class RedisRequestLimitStore(IConnectionMultiplexer connection) : IRequestLimitStore
{
    // Check every quota before incrementing any of them. Expiry is set atomically on the first hit.
    // All keys use the same Redis cluster hash tag so this also works on a clustered store.
    private const string Script = """
        local wait = 0
        for i, key in ipairs(KEYS) do
            local count = tonumber(redis.call('GET', key) or '0')
            if count >= tonumber(ARGV[(i - 1) * 2 + 1]) then
                wait = math.max(wait, redis.call('PTTL', key), 1)
            end
        end
        if wait > 0 then return math.max(1, math.ceil(wait / 1000)) end
        for i, key in ipairs(KEYS) do
            local count = redis.call('INCR', key)
            if count == 1 then
                redis.call('PEXPIRE', key, tonumber(ARGV[(i - 1) * 2 + 2]) * 1000)
            end
        end
        return 0
        """;

    public async Task<int> TryAcquireAsync(IReadOnlyList<RequestQuota> quotas)
    {
        var keys = quotas.Select(x => (RedisKey)x.Key).ToArray();
        var arguments = quotas.SelectMany(x => new RedisValue[] { x.Limit, x.WindowSeconds }).ToArray();
        return (int)await connection.GetDatabase().ScriptEvaluateAsync(Script, keys, arguments);
    }
}
