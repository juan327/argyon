using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Argyon.Backend.App.Shared.Scopeds;

public class BackgroundTask : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly int delayInMinutes = 60; // You can adjust the time interval according to your needs

    public BackgroundTask(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var scope = this._serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DataContext>();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var dateTimeUtcNow = DateTime.UtcNow;
                var listUserSessions = await db.UserSessions.Where(us => us.ExpiresAt < dateTimeUtcNow).ToListAsync(stoppingToken);
                if (listUserSessions.Any())
                {
                    foreach (var userSession in listUserSessions)
                    {
                        JwtEventsHandler.memoryCache.Remove(userSession.Token);
                    }
                    db.UserSessions.RemoveRange(listUserSessions);
                    await db.SaveChangesAsync(stoppingToken);
                }

                var listRefreshTokens = await db.RefreshTokens
                    .Where(rt => rt.ExpiresAt < dateTimeUtcNow || rt.IsRevoked)
                    .ToListAsync(stoppingToken);
                if (listRefreshTokens.Any())
                {
                    db.RefreshTokens.RemoveRange(listRefreshTokens);
                    await db.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
            }
            finally
            {
                await Task.Delay(delayInMinutes * 60 * 1000, stoppingToken);
            }
        }
        db.Dispose();
        scope.Dispose();
    }
}