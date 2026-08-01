using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Shared.Services;

public static class RateLimitingSetup
{
    // Stage 1: applies to ALL requests (public and protected) before
    // UseAuthentication/UseAuthorization, partitioned by IP. Protected routes
    // consume this quota as if they were not logged in.
    public static RateLimiterOptions CreatePublicLimiterOptions(IConfiguration configuration)
    {
        var settings = GetSettings(configuration);
        var options = new RateLimiterOptions();
        ConfigureRejection(options);

        if (settings.Public.Enabled == false)
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ => RateLimitPartition.GetNoLimiter("no-limit"));
            return options;
        }

        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        {
            var ip = GetIp(httpContext);
            return RateLimitPartition.GetFixedWindowLimiter("ip:" + ip, _ => BuildWindowOptions(settings.Public));
        });

        return options;
    }

    // Stage 2: applies after UseAuthentication/UseAuthorization, only to
    // protected endpoints ([Authorize] without [AllowAnonymous]) that already passed
    // JWT validation, partitioned by user.
    public static RateLimiterOptions CreateAuthenticatedLimiterOptions(IConfiguration configuration)
    {
        var settings = GetSettings(configuration);
        var options = new RateLimiterOptions();
        ConfigureRejection(options);

        if (settings.Authenticated.Enabled == false)
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ => RateLimitPartition.GetNoLimiter("no-limit"));
            return options;
        }

        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        {
            if (RequiresAuthenticatedLimit(httpContext) == false)
            {
                return RateLimitPartition.GetNoLimiter("no-limit");
            }

            var userId = httpContext.Items["UserId"] as Guid?;
            var partitionKey = "user:" + (userId?.ToString() ?? GetIp(httpContext));

            return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => BuildWindowOptions(settings.Authenticated));
        });

        return options;
    }

    private static RateLimitingSettings GetSettings(IConfiguration configuration)
    {
        return configuration.GetSection("RateLimiting").Get<RateLimitingSettings>() ?? new RateLimitingSettings();
    }

    private static void ConfigureRejection(RateLimiterOptions options)
    {
        options.RejectionStatusCode = (int)HttpStatusCode.TooManyRequests;

        options.OnRejected = async (context, cancellationToken) =>
        {
            if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            {
                context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
            }

            var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();
            context.HttpContext.Response.ContentType = "application/json";
            await context.HttpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi
            {
                Message = localizer["RateLimitExceeded"],
            }, cancellationToken);
        };
    }

    private static FixedWindowRateLimiterOptions BuildWindowOptions(RateLimitRuleSettings rule)
    {
        return new FixedWindowRateLimiterOptions
        {
            PermitLimit = rule.PermitLimit,
            Window = TimeSpan.FromSeconds(rule.WindowSeconds),
            QueueLimit = rule.QueueLimit,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            AutoReplenishment = true,
        };
    }

    private static string GetIp(HttpContext httpContext)
    {
        return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    // An endpoint is considered "logged-in user" when it requires [Authorize] and
    // does not have [AllowAnonymous].
    private static bool RequiresAuthenticatedLimit(HttpContext httpContext)
    {
        var metadata = httpContext.GetEndpoint()?.Metadata;
        if (metadata == null)
        {
            return false;
        }

        return metadata.GetMetadata<IAuthorizeData>() != null && metadata.GetMetadata<IAllowAnonymous>() == null;
    }
}
