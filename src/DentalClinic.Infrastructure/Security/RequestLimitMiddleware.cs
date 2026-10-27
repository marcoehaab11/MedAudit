using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace DentalClinic.Infrastructure.Security;

public sealed class RequestLimitMiddleware
{
    private readonly RequestDelegate next;
    private readonly bool administrator;
    private readonly byte[] keySecret;
    private static readonly PartitionedRateLimiter<string> HealthLimiter = PartitionedRateLimiter.Create<string, string>(
        address => RateLimitPartition.GetFixedWindowLimiter(address, _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    public RequestLimitMiddleware(RequestDelegate next, IConfiguration configuration, bool administrator)
    {
        this.next = next;
        this.administrator = administrator;
        var secret = configuration["RateLimiting:KeySecret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException("RateLimiting:KeySecret must contain at least 32 random characters. Set RATE_LIMIT_KEY_SECRET in .env for Docker.");
        keySecret = Encoding.UTF8.GetBytes(secret);
    }

    public async Task InvokeAsync(HttpContext context, IRequestLimitStore store)
    {
        var address = context.Connection.RemoteIpAddress?.MapToIPv6().ToString() ?? "unknown";
        if (context.Request.Path.StartsWithSegments("/health"))
        {
            // Liveness must remain independent of Redis, otherwise a Redis outage restarts healthy servers.
            using var lease = await HealthLimiter.AcquireAsync(address, cancellationToken: context.RequestAborted);
            if (!lease.IsAcquired) { await RejectAsync(context, 429, 60); return; }
            await next(context);
            return;
        }

        try
        {
            var caller = Caller(context, address);
            // Bound work (including parsing account names) before inspecting request bodies.
            var wait = await store.TryAcquireAsync([Quota("request-flood", caller, 600, 60)]);
            if (wait > 0) { await RejectAsync(context, 429, wait); return; }

            var policy = RequestLimitPolicy.Select(context.Request, administrator);
            var limit = (policy.Name is "read" or "admin-read") && !context.User.Identities.Any(x => x.IsAuthenticated) ? 120 : policy.Limit;
            List<RequestQuota> quotas = [Quota(policy.Name, caller, limit, policy.WindowSeconds)];
            if (policy.ReadAccount)
            {
                var account = await ReadAccountAsync(context);
                if (account is null) return;
                quotas.Add(Quota(policy.Name + ":account", account, policy.AccountLimit, policy.WindowSeconds));
            }
            wait = await store.TryAcquireAsync(quotas);
            if (wait > 0) { await RejectAsync(context, 429, wait); return; }
        }
        catch (Exception exception) when (exception is RedisException or TimeoutException)
        {
            await RejectAsync(context, 503, 30);
            return;
        }
        await next(context);
    }

    public static string Caller(HttpContext context, string address)
    {
        var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.User.FindFirstValue("sub");
        return context.User.Identities.Any(x => x.IsAuthenticated) && Guid.TryParse(id, out var userId)
            ? "user:" + userId.ToString("D") : "ip:" + address;
    }

    private RequestQuota Quota(string bucket, string identity, int limit, int seconds)
    {
        var hash = Convert.ToHexString(HMACSHA256.HashData(keySecret, Encoding.UTF8.GetBytes(identity)));
        return new("meddentist:{request-limits}:v1:" + bucket + ":" + hash, limit, seconds);
    }

    private static async Task<string?> ReadAccountAsync(HttpContext context)
    {
        // These endpoints accept only a small login/email payload, never a registration logo or upload.
        const int maximum = 16384;
        if (context.Request.ContentLength > maximum)
        {
            context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
            await context.Response.WriteAsJsonAsync(new { message = "This login or email request is too large." }, context.RequestAborted);
            return null;
        }
        context.Request.EnableBuffering();
        var bytes = new byte[maximum + 1];
        var length = 0;
        try
        {
            while (length < bytes.Length)
            {
                var read = await context.Request.Body.ReadAsync(bytes.AsMemory(length), context.RequestAborted);
                if (read == 0) break;
                length += read;
            }
            if (length > maximum)
            {
                context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                await context.Response.WriteAsJsonAsync(new { message = "This login or email request is too large." }, context.RequestAborted);
                return null;
            }
        }
        finally { context.Request.Body.Position = 0; }

        var account = "";
        if (context.Request.HasFormContentType)
        {
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            account = form["Input.Email"].ToString();
        }
        else
        {
            try
            {
                using var document = JsonDocument.Parse(bytes.AsMemory(0, length));
                if (document.RootElement.ValueKind == JsonValueKind.Object)
                    foreach (var property in document.RootElement.EnumerateObject())
                        if (property.Name.Equals("email", StringComparison.OrdinalIgnoreCase) && property.Value.ValueKind == JsonValueKind.String)
                            account = property.Value.GetString() ?? "";
            }
            catch (JsonException) { /* The endpoint will return its normal validation error. */ }
        }
        // Same normalization as Identity; invalid/missing account names still consume the caller quota.
        return account.Trim().ToUpperInvariant();
    }

    private static async Task RejectAsync(HttpContext context, int status, int seconds)
    {
        var english = status == 429 ? $"Too many requests. Please wait {seconds} seconds and try again."
            : "Request protection is temporarily unavailable. Please wait 30 seconds and try again.";
        var arabic = status == 429 ? $"طلبات كثيرة جدًا. انتظر {seconds} ثانية ثم حاول مرة أخرى."
            : "خدمة حماية الطلبات غير متاحة مؤقتًا. انتظر 30 ثانية ثم حاول مرة أخرى.";
        context.Response.StatusCode = status;
        context.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        context.Response.Headers.CacheControl = "no-store";
        if (context.Request.Path.StartsWithSegments("/api") || !context.Request.Headers.Accept.ToString().Contains("text/html", StringComparison.OrdinalIgnoreCase))
        {
            await context.Response.WriteAsJsonAsync(new { status, code = status == 429 ? "rate_limit_exceeded" : "rate_limit_unavailable",
                title = english, detail = english, message = english, messageAr = arabic, retryAfter = seconds }, context.RequestAborted);
        }
        else
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.WriteAsync($"<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><title>يرجى الانتظار</title><main><h1>يرجى الانتظار</h1><p>{arabic}</p><p lang=\"en\" dir=\"ltr\">{english}</p></main></html>", context.RequestAborted);
        }
    }
}
