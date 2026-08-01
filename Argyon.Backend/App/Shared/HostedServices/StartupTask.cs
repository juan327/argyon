using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.HostedServices;

public class StartupTask : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;

    public StartupTask(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = this._serviceProvider.CreateScope();

        var db = scope.ServiceProvider.GetRequiredService<DataContext>();
        db.Database.EnsureCreated();

        // Same as the tables above: EnsureCreated() does not apply this index to an already
        // existing database, so it is created here idempotently so that /Note streaming
        // can read the notes already sorted by the engine instead of sorting everything in memory.
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE INDEX IF NOT EXISTS idx_notes_user_id_is_folder_updated_at
            ON notes (user_id, is_folder, updated_at);
        ", cancellationToken);

        // Single global configuration row (id = 1); seeded only if it does not exist yet.
        if (db.SystemSettings.Any(s => s.Id == 1) == false)
        {
            await db.SystemSettings.AddAsync(new EntitySystemSettings {
                Id = 1,
                RegistrationEnabled = true,
                CanManageNotesAdministrator = true,
                CanUseTwoFactorAdministrator = true,
                CanManageNotesUser = true,
                CanUseTwoFactorUser = true,
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}