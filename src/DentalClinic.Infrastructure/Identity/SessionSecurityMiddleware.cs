using Microsoft.AspNetCore.Http;
using StackExchange.Redis;

namespace DentalClinic.Infrastructure.Identity;

public sealed class SessionSecurityMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        // Cookie-authenticated writes must originate from this app. Browsers cannot set this header
        // on cross-origin requests without a successful CORS preflight; this app does not enable CORS.
        if (context.Request.Path.StartsWithSegments("/api") &&
            !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method) &&
            context.Request.Headers["X-App-Request"] != "1")
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { message = "Please submit this request from the application." }, context.RequestAborted);
            return;
        }
        try { await next(context); }
        catch (Exception error) when ((error is RedisException or TimeoutException) && !context.Response.HasStarted)
        {
            context.Response.Clear();
            context.Response.StatusCode = 503;
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new { code = "session_unavailable", message = "Session verification is temporarily unavailable. Please try again shortly.",
                messageAr = "التحقق من جلسة الدخول غير متاح مؤقتًا. حاول مرة أخرى بعد قليل." }, context.RequestAborted);
        }
    }
}
