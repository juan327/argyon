using System.Net;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Shared.Middlewares;

// A blocked user/administrator can still log in, but their session is restricted
// to only being able to export their data (encrypted or in plain text): they can log in/out,
// check their own status and read their notes, but no other action (create/edit notes,
// import, manage users, TOTP, etc). Registered after UseAuthorization() so that
// HttpContext.Items["UserId"] (populated by JwtEventsHandler) is already available.
public class BlockedUserRestrictionMiddleware
{
    private readonly RequestDelegate _next;

    private static readonly HashSet<(string Method, string Path)> AllowedRoutes = new()
    {
        ("GET", "/api/user/me"),
        ("GET", "/api/user/ping"),
        ("POST", "/api/user/logout"),
        ("POST", "/api/user/refresh"),
        ("POST", "/api/user/validatepassword"),
        ("POST", "/api/user/login"),
        ("POST", "/api/user/register"),
        ("POST", "/api/totp/verifylogin"),
        ("GET", "/api/settings"),
        ("GET", "/api/note"),
    };

    public BlockedUserRestrictionMiddleware(RequestDelegate next)
    {
        this._next = next;
    }

    public async Task InvokeAsync(HttpContext httpContext, DataContext db, IStringLocalizer<SharedResource> localizer)
    {
        var userId = httpContext.Items["UserId"] as Guid?;
        if (userId != null)
        {
            var isBlocked = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId.Value)
                .Select(u => u.IsBlocked)
                .FirstOrDefaultAsync();

            if (isBlocked == true)
            {
                var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
                var method = httpContext.Request.Method.ToUpperInvariant();
                if (AllowedRoutes.Contains((method, path)) == false)
                {
                    httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                    httpContext.Response.ContentType = "application/json";
                    await httpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi
                    {
                        Message = localizer["AccountBlockedExportOnly"],
                    });
                    return;
                }
            }
        }

        await _next(httpContext);
    }
}
