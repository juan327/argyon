using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Shared.Services;

public class PermissionService : IPermissionService
{
    private readonly DataContext db;
    private readonly ISystemSettingsCache systemSettingsCache;

    public PermissionService(DataContext _db, ISystemSettingsCache _systemSettingsCache)
    {
        this.db = _db;
        this.systemSettingsCache = _systemSettingsCache;
    }

    public async Task<EffectivePermissions> GetEffectivePermissions(EntityUser caller)
    {
        // The Owner is never subject to any permission.
        if (caller.RoleCode == EntityUser_RoleCode.Owner)
        {
            return new EffectivePermissions(true, true);
        }

        var overridePermissions = await this.db.UserPermissions.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == caller.Id);
        var settings = await this.systemSettingsCache.Get(this.db);
        var isAdministrator = caller.RoleCode == EntityUser_RoleCode.Administrator;

        bool Resolve(bool? overrideValue, bool? administratorDefault, bool? userDefault)
        {
            if (overrideValue.HasValue)
            {
                return overrideValue.Value;
            }
            return (isAdministrator ? administratorDefault : userDefault) ?? true;
        }

        return new EffectivePermissions(
            CanManageNotes: Resolve(overridePermissions?.CanManageNotesOverride, settings?.CanManageNotesAdministrator, settings?.CanManageNotesUser),
            CanUseTwoFactor: Resolve(overridePermissions?.CanUseTwoFactorOverride, settings?.CanUseTwoFactorAdministrator, settings?.CanUseTwoFactorUser)
        );
    }

    public async Task<bool> HasPermission(EntityUser caller, PermissionCode permission)
    {
        var effective = await this.GetEffectivePermissions(caller);
        return permission switch
        {
            PermissionCode.ManageNotes => effective.CanManageNotes,
            PermissionCode.TwoFactor => effective.CanUseTwoFactor,
            _ => true,
        };
    }
}
