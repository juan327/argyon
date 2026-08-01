using System.Text;
using ApiSqliteDemo.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Localization;

namespace Argyon.Backend.App.Shared.Scopeds;

public class JwtEventsHandler: JwtBearerEvents
{
    private readonly IServiceProvider serviceProvider;
    public static MemoryCache memoryCache = new MemoryCache(new MemoryCacheOptions());

    public JwtEventsHandler(IServiceProvider _serviceProvider)
    {
        this.serviceProvider = _serviceProvider;
    }

    public override Task MessageReceived(MessageReceivedContext context)
    {
        var token = context.Request.Cookies["access_token"];
        if (string.IsNullOrEmpty(token) == false)
        {
            context.Token = token;
        }
        // here you can extract the token from the cookie or elsewhere, if it hasn't been done in the middleware
        //return base.MessageReceived(context);
        return Task.CompletedTask;
    }

    public override Task AuthenticationFailed(AuthenticationFailedContext context)
    {
        // here you can handle authentication errors, such as invalid or expired tokens
        Console.WriteLine("AuthenticationFailed: " + context.Exception.Message);
        return base.AuthenticationFailed(context);
    }

    public override async Task TokenValidated(TokenValidatedContext context)
    {
        var token = context.Request.Cookies["access_token"];
        var (userId, isValid) = await this.ValidateToken(token);
        if (isValid == false)        {
            var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();
            context.Fail(localizer["InvalidToken"]);
            return;
        }
        context.HttpContext.Items["UserId"] = userId;

        await base.TokenValidated(context);
    }

    private async Task<(Guid?, bool)> ValidateToken(string? token)
    {
        if (string.IsNullOrEmpty(token))
            return (null, false);
        if (memoryCache.TryGetValue(token, out Guid userId))
            return (userId, true);

        using var scope = this.serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DataContext>();

        var findUserSession = await db.UserSessions.AsNoTracking().FirstOrDefaultAsync(us => us.Token == token);
        if (findUserSession == null)
        {
            return (null, false);
        }

        if (findUserSession.ExpiresAt < DateTime.UtcNow)
        {
            return (null, false);
        }

        memoryCache.Set(token, findUserSession.UserId, findUserSession.ExpiresAt - DateTime.UtcNow);
        return (findUserSession.UserId, true);
    }
}