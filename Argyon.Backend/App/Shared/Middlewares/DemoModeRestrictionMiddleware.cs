using System.Net;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.Middlewares;

// Only registered when DemoMode:Enabled is true (see Program.cs). Any non-GET/HEAD/OPTIONS
// request is treated as a write and rejected unless it's one of the session/auth lifecycle
// routes below (needed just to log in and look around) or the caller is the Owner.
public class DemoModeRestrictionMiddleware
{
    private readonly RequestDelegate _next;

    private static readonly HashSet<(string Method, string Path)> AllowedWriteRoutes = new()
    {
        ("POST", "/api/user/login"),
        ("POST", "/api/user/prelogin"),
        ("POST", "/api/user/logout"),
        ("POST", "/api/user/refresh"),
        ("POST", "/api/user/validatepassword"),
        ("POST", "/api/totp/verifylogin"),
    };

    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "HEAD", "OPTIONS",
    };

    public DemoModeRestrictionMiddleware(RequestDelegate next)
    {
        this._next = next;
    }

    public async Task InvokeAsync(HttpContext httpContext, DataContext db, IStringLocalizer<SharedResource> localizer)
    {
        var method = httpContext.Request.Method.ToUpperInvariant();
        if (SafeMethods.Contains(method) == false)
        {
            var path = httpContext.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
            var allowed = AllowedWriteRoutes.Contains((method, path));

            if (allowed == false)
            {
                var userId = httpContext.Items["UserId"] as Guid?;
                if (userId != null)
                {
                    var roleCode = await db.Users.AsNoTracking()
                        .Where(u => u.Id == userId.Value)
                        .Select(u => u.RoleCode)
                        .FirstOrDefaultAsync();

                    allowed = roleCode == EntityUser_RoleCode.Owner;
                }
            }

            if (allowed == false)
            {
                httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                httpContext.Response.ContentType = "application/json";
                string message = localizer["DemoModeReadOnly"];
                await httpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi
                {
                    Message = message,
                });
                return;
            }
        }

        await _next(httpContext);
    }
}
