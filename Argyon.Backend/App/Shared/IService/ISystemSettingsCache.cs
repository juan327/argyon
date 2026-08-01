using ApiSqliteDemo.Data;
using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.IServices;

public interface ISystemSettingsCache
{
    Task<EntitySystemSettings> Get(DataContext db);
    void Set(EntitySystemSettings settings);
}
