using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Shared.Services;

public class NoteLimitService : INoteLimitService
{
    private readonly DataContext db;
    private readonly IStringLocalizer<SharedResource> localizer;
    private readonly ISystemSettingsCache systemSettingsCache;

    public NoteLimitService(DataContext _db, IStringLocalizer<SharedResource> _localizer, ISystemSettingsCache _systemSettingsCache)
    {
        this.db = _db;
        this.localizer = _localizer;
        this.systemSettingsCache = _systemSettingsCache;
    }

    public async Task<string?> CheckLimit(EntityUser caller, bool isFolder, int itemsToAdd = 1)
    {
        // The Owner is never subject to a limit.
        if (caller.RoleCode == EntityUser_RoleCode.Owner)
        {
            return null;
        }

        // Convention for EntityUser.MaxNotesOverride/MaxFoldersOverride: null = inherits the role's
        // limit, -1 = unlimited (explicit override), >=0 = own cap.
        var overrideValue = isFolder ? caller.MaxFoldersOverride : caller.MaxNotesOverride;

        long? limit;
        if (overrideValue == -1)
        {
            limit = null;
        }
        else if (overrideValue.HasValue)
        {
            limit = overrideValue.Value;
        }
        else
        {
            var settings = await this.systemSettingsCache.Get(this.db);
            limit = caller.RoleCode switch
            {
                EntityUser_RoleCode.Administrator => isFolder ? settings?.MaxFoldersAdministrator : settings?.MaxNotesAdministrator,
                _ => isFolder ? settings?.MaxFoldersUser : settings?.MaxNotesUser,
            };
        }

        // Convention for EntitySystemSettings.MaxNotes*/MaxFolders*: null = unlimited.
        if (limit == null)
        {
            return null;
        }

        var count = await this.db.Notes.CountAsync(n => n.UserId == caller.Id && n.IsFolder == isFolder);
        if (count + itemsToAdd > limit)
        {
            return isFolder
                ? this.localizer["FolderLimitReached"]
                : this.localizer["NoteLimitReached"];
        }

        return null;
    }
}
