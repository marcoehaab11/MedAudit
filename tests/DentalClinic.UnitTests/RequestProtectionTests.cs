using System.Net;
using System.Security.Claims;
using System.Text;
using DentalClinic.Infrastructure.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace DentalClinic.UnitTests;

public sealed class RequestProtectionTests
{
    [Theory]
    [InlineData("/api/public/clinics/register", "POST", false, "signup", 5, 3600)]
    [InlineData("/api/auth/login", "POST", false, "login", 30, 900)]
    [InlineData("/Account/Login", "POST", true, "login", 30, 900)]
    [InlineData("/api/auth/forgot-password", "POST", false, "reset-email", 10, 3600)]
    [InlineData("/api/public/clinics/resend", "POST", false, "resend-email", 10, 3600)]
    [InlineData("/api/auth/invitations/inspect", "POST", false, "invitation-inspect", 30, 900)]
    [InlineData("/api/public/clinics/dentist/bookings", "POST", false, "public-booking", 5, 3600)]
    [InlineData("/api/public/clinics/dentist/inquiries", "POST", false, "public-inquiry", 5, 3600)]
    [InlineData("/api/public/clinics/dentist/visits", "POST", false, "public-visits", 30, 60)]
    [InlineData("/api/public/bookings/manage/secret/cancel", "POST", false, "manage-cancel", 10, 3600)]
    [InlineData("/api/public/clinics/dentist/availability", "GET", false, "public-read", 120, 60)]
    [InlineData("/api/reports/export/financial", "GET", false, "bulk-files", 5, 900)]
    [InlineData("/api/prescriptions/123/document", "GET", false, "documents", 30, 60)]
    [InlineData("/api/backups/export-clinic", "POST", false, "bulk-files", 5, 900)]
    [InlineData("/api/users/invitations", "POST", false, "account-create", 10, 3600)]
    [InlineData("/api/users/123/permissions", "PUT", false, "access-write", 30, 3600)]
    [InlineData("/api/new-future-endpoint", "POST", false, "write", 120, 60)]
    [InlineData("/api/new-future-endpoint", "GET", false, "read", 300, 60)]
    public void RoutesReceiveExpectedPolicy(string path, string method, bool admin, string name, int limit, int seconds)
    {
        var context = Request(path, method);
        var policy = RequestLimitPolicy.Select(context.Request, admin);
        Assert.Equal((name, limit, seconds), (policy.Name, policy.Limit, policy.WindowSeconds));
    }

    [Theory]
    [InlineData("/admin/email", "Test", "admin-email")]
    [InlineData("/admin/email", "rEtRy", "admin-email")]
    [InlineData("/admin/clinics/123", "Backup", "bulk-files")]
    [InlineData("/admin/clinics/123", "PreviewRestore", "bulk-files")]
    [InlineData("/admin/clinics/123", "Restore", "bulk-files")]
    public void AdminHandlersReceiveSpecificLimits(string path, string handler, string bucket)
    {
        var context = Request(path, "POST");
        context.Request.QueryString = new QueryString("?handler=" + handler);
        Assert.Equal(bucket, RequestLimitPolicy.Select(context.Request, true).Name);
    }

    [Fact]
    public void RepeatedHandlerParameterCannotBypassEmailQuota()
    {
        var context = Request("/admin/email", "POST");
        context.Request.QueryString = new QueryString("?handler=Test&handler=Other");
        Assert.Equal("admin-email", RequestLimitPolicy.Select(context.Request, true).Name);
    }

    [Fact]
    public async Task LoginAccountCannotEvadeLimitByChangingIpOrServerOrEmailCase()
    {
        var store = new MemoryStore();
        var calls = 0;
        var api = Limiter(_ => { calls++; return Task.CompletedTask; });
        var admin = Limiter(_ => { calls++; return Task.CompletedTask; }, true);
        for (var i = 0; i < 10; i++)
        {
            var context = Request("/api/auth/login", "POST", $"192.0.2.{i + 1}", "{\"email\":\"USER@example.com\"}");
            await api.InvokeAsync(context, store);
            Assert.Equal(200, context.Response.StatusCode);
        }
        var rejected = Request("/Account/Login", "POST", "192.0.2.99", "Input.Email=user%40example.com&Input.Password=incorrect");
        rejected.Request.ContentType = "application/x-www-form-urlencoded";
        rejected.Request.Headers.Accept = "text/html";
        await admin.InvokeAsync(rejected, store);
        Assert.Equal(429, rejected.Response.StatusCode);
        Assert.Equal("900", rejected.Response.Headers.RetryAfter);
        Assert.Contains("انتظر", Body(rejected));
        Assert.Equal(10, calls);
        Assert.DoesNotContain(store.Keys, key => key.Contains("example", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task CallerQuotaBlocksTryingManyDifferentAccounts()
    {
        var store = new MemoryStore();
        var limiter = Limiter(_ => Task.CompletedTask);
        for (var i = 0; i < 30; i++)
            await limiter.InvokeAsync(Request("/api/auth/login", "POST", body: $"{{\"email\":\"user{i}@example.com\"}}"), store);
        var rejected = Request("/api/auth/login", "POST", body: "{\"email\":\"another@example.com\"}");
        await limiter.InvokeAsync(rejected, store);
        Assert.Equal(429, rejected.Response.StatusCode);
        Assert.Contains("rate_limit_exceeded", Body(rejected));
    }

    [Fact]
    public async Task EmailLimitExpiresAndRequestBodyRemainsReadable()
    {
        var store = new MemoryStore();
        const string payload = "{\"email\":\"patient@example.com\"}";
        var calls = 0;
        var limiter = Limiter(async context =>
        {
            using var reader = new StreamReader(context.Request.Body);
            Assert.Equal(payload, await reader.ReadToEndAsync());
            calls++;
        });
        for (var i = 0; i < 3; i++) await limiter.InvokeAsync(Request("/api/auth/forgot-password", "POST", body: payload), store);
        var rejected = Request("/api/auth/forgot-password", "POST", body: payload);
        await limiter.InvokeAsync(rejected, store);
        Assert.Equal(429, rejected.Response.StatusCode);
        Assert.Equal("3600", rejected.Response.Headers.RetryAfter);
        store.Now = 3600;
        await limiter.InvokeAsync(Request("/api/auth/forgot-password", "POST", body: payload), store);
        Assert.Equal(4, calls);
    }

    [Fact]
    public async Task SignedInUsersHaveSeparateQuotasEvenWhenSharingIpAndChangingClinic()
    {
        var store = new MemoryStore();
        var limiter = Limiter(_ => Task.CompletedTask);
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        for (var i = 0; i < 5; i++)
        {
            var context = Request("/api/backups/export", "POST");
            SignIn(context, first);
            await limiter.InvokeAsync(context, store);
        }
        var rejected = Request("/api/backups/export-clinic", "POST");
        SignIn(rejected, first);
        rejected.User.Identities.First().AddClaim(new Claim("tenant_id", Guid.NewGuid().ToString()));
        await limiter.InvokeAsync(rejected, store);
        Assert.Equal(429, rejected.Response.StatusCode);
        var allowed = Request("/api/backups/export", "POST");
        SignIn(allowed, second);
        await limiter.InvokeAsync(allowed, store);
        Assert.Equal(200, allowed.Response.StatusCode);
    }

    [Fact]
    public async Task RedisOutageStopsActionButDoesNotBreakLiveness()
    {
        var calls = 0;
        var limiter = Limiter(_ => { calls++; return Task.CompletedTask; });
        var request = Request("/api/public/clinics/test/bookings", "POST");
        await limiter.InvokeAsync(request, new UnavailableStore());
        Assert.Equal(503, request.Response.StatusCode);
        Assert.Equal("30", request.Response.Headers.RetryAfter);
        Assert.Equal(0, calls);
        var live = Request("/health/live");
        await limiter.InvokeAsync(live, new UnavailableStore());
        Assert.Equal(200, live.Response.StatusCode);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task OversizedAccountPayloadNeverReachesLogin()
    {
        var limiter = Limiter(_ => throw new InvalidOperationException("Must not reach login"));
        var context = Request("/api/auth/login", "POST", body: new string('x', 16385));
        await limiter.InvokeAsync(context, new MemoryStore());
        Assert.Equal(413, context.Response.StatusCode);
    }

    [Theory]
    [InlineData("203.0.113.4", "172.30.74.10", false)]
    [InlineData("172.30.74.10", "172.30.74.10", true)]
    [InlineData("203.0.113.4", "", false)]
    public async Task OnlyConfiguredProxyMayForwardClientAddress(string remote, string trusted, bool accepted)
    {
        var services = new ServiceCollection();
        services.AddRequestProtection(Configuration(new Dictionary<string, string?> { ["RateLimiting:TrustedProxies"] = trusted }));
        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>();
        var middleware = new ForwardedHeadersMiddleware(_ => Task.CompletedTask, NullLoggerFactory.Instance, options);
        var context = Request("/api/auth/login", "POST", remote);
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.20";
        await middleware.Invoke(context);
        Assert.Equal(accepted ? "198.51.100.20" : remote, context.Connection.RemoteIpAddress!.ToString());
    }

    private static RequestLimitMiddleware Limiter(RequestDelegate next, bool admin = false) => new(next,
        Configuration(new Dictionary<string, string?> { ["RateLimiting:KeySecret"] = new string('k', 64) }), admin);

    private static IConfiguration Configuration(Dictionary<string, string?> values) => new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static DefaultHttpContext Request(string path, string method = "GET", string address = "192.0.2.1", string body = "")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        context.Connection.RemoteIpAddress = IPAddress.Parse(address);
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static string Body(HttpContext context) => Encoding.UTF8.GetString(((MemoryStream)context.Response.Body).ToArray());

    private static void SignIn(HttpContext context, Guid id) => context.User = new ClaimsPrincipal(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, id.ToString())], "Test"));

    private sealed class UnavailableStore : IRequestLimitStore
    {
        public Task<int> TryAcquireAsync(IReadOnlyList<RequestQuota> quotas) => throw new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Test outage");
    }

    private sealed class MemoryStore : IRequestLimitStore
    {
        private readonly Dictionary<string, (int Count, int Expires)> values = [];
        public int Now { get; set; }
        public IEnumerable<string> Keys => values.Keys;
        public Task<int> TryAcquireAsync(IReadOnlyList<RequestQuota> quotas)
        {
            var wait = 0;
            foreach (var quota in quotas)
                if (values.TryGetValue(quota.Key, out var value) && value.Expires > Now && value.Count >= quota.Limit)
                    wait = Math.Max(wait, value.Expires - Now);
            if (wait > 0) return Task.FromResult(wait);
            foreach (var quota in quotas)
            {
                var value = values.GetValueOrDefault(quota.Key);
                values[quota.Key] = value.Expires > Now ? (value.Count + 1, value.Expires) : (1, Now + quota.WindowSeconds);
            }
            return Task.FromResult(0);
        }
    }
}
