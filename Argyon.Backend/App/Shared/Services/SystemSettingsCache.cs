using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Shared.Services;

public class SystemSettingsCache : ISystemSettingsCache
{
    private EntitySystemSettings? cached;

    public async Task<EntitySystemSettings> Get(DataContext db)
    {
        if (this.cached is not null)
        {
            return this.cached;
        }

        this.cached = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1)
            ?? new EntitySystemSettings { Id = 1 };
        return this.cached;
    }

    public void Set(EntitySystemSettings settings)
    {
        this.cached = settings;
    }
}
