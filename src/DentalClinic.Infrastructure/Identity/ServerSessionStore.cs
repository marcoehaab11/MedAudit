using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Distributed;

namespace DentalClinic.Infrastructure.Identity;

// The browser holds only an encrypted reference. The actual ticket lives in Redis.
// Removing the ticket on sign-out also rejects a replay of a previously copied cookie.
public sealed class ServerSessionStore(IDistributedCache cache) : ITicketStore
{
    private const string Prefix = "meddentist:sessions:v1:";

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Prefix + Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await RenewAsync(key, ticket);
        return key;
    }

    public Task RenewAsync(string key, AuthenticationTicket ticket) => cache.SetAsync(key,
        TicketSerializer.Default.Serialize(ticket), new DistributedCacheEntryOptions
        { AbsoluteExpiration = ticket.Properties.ExpiresUtc ?? DateTimeOffset.UtcNow.AddHours(12) });

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        if (!key.StartsWith(Prefix, StringComparison.Ordinal)) return null;
        var value = await cache.GetAsync(key);
        return value is null ? null : TicketSerializer.Default.Deserialize(value);
    }

    public Task RemoveAsync(string key) => cache.RemoveAsync(key);
}
