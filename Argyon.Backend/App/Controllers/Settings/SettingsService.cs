using System.Net;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Controllers.Settings;

public class SettingsService : ISettingsService
{
    private readonly DataContext db;
    private readonly IContentLimitService contentLimitService;
    private readonly ISystemSettingsCache systemSettingsCache;
    private readonly IStringLocalizer<SharedResource> localizer;

    public SettingsService(DataContext _db, IContentLimitService _contentLimitService, ISystemSettingsCache _systemSettingsCache, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.contentLimitService = _contentLimitService;
        this.systemSettingsCache = _systemSettingsCache;
        this.localizer = _localizer;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOSettings.DTOSystemSettings>> Get()
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOSettings.DTOSystemSettings>();
        try
        {
            var settings = await this.systemSettingsCache.Get(this.db);
            var hasAnyUser = await this.db.Users.AnyAsync();
            response.Data = new DTOSettings.DTOSystemSettings
            {
                RegistrationEnabled = settings.RegistrationEnabled,
                HasAnyUser = hasAnyUser,
                MaxNotesAdministrator = settings.MaxNotesAdministrator,
                MaxFoldersAdministrator = settings.MaxFoldersAdministrator,
                MaxNotesUser = settings.MaxNotesUser,
                MaxFoldersUser = settings.MaxFoldersUser,
                CanManageNotesAdministrator = settings.CanManageNotesAdministrator,
                CanUseTwoFactorAdministrator = settings.CanUseTwoFactorAdministrator,
                CanManageNotesUser = settings.CanManageNotesUser,
                CanUseTwoFactorUser = settings.CanUseTwoFactorUser,
                MaxNoteNameCharsAdministrator = settings.MaxNoteNameCharsAdministrator,
                MaxNoteNameCharsUser = settings.MaxNoteNameCharsUser,
                MaxNoteDescriptionCharsAdministrator = settings.MaxNoteDescriptionCharsAdministrator,
                MaxNoteDescriptionCharsUser = settings.MaxNoteDescriptionCharsUser,
                MaxNoteTagsCharsAdministrator = settings.MaxNoteTagsCharsAdministrator,
                MaxNoteTagsCharsUser = settings.MaxNoteTagsCharsUser,
                MaxNoteDataKbAdministrator = settings.MaxNoteDataKbAdministrator,
                MaxNoteDataKbUser = settings.MaxNoteDataKbUser,
                MaxAttachmentFileSizeKbAdministrator = settings.MaxAttachmentFileSizeKbAdministrator,
                MaxAttachmentFileSizeKbUser = settings.MaxAttachmentFileSizeKbUser,
            };
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetRegistrationEnabled(VMSettings.VMSetRegistrationEnabled request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifySettingsPermission"];
                return response;
            }

            var settings = await this.db.SystemSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new EntitySystemSettings { Id = 1 };
                this.db.SystemSettings.Add(settings);
            }
            settings.RegistrationEnabled = request.Enabled;

            await this.db.SaveChangesAsync();
            this.systemSettingsCache.Set(settings);

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["SettingsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetLimits(VMSettings.VMSetLimits request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifySettingsPermission"];
                return response;
            }

            var settings = await this.db.SystemSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new EntitySystemSettings { Id = 1 };
                this.db.SystemSettings.Add(settings);
            }
            settings.MaxNotesAdministrator = request.MaxNotesAdministrator;
            settings.MaxFoldersAdministrator = request.MaxFoldersAdministrator;
            settings.MaxNotesUser = request.MaxNotesUser;
            settings.MaxFoldersUser = request.MaxFoldersUser;

            await this.db.SaveChangesAsync();
            this.systemSettingsCache.Set(settings);

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["LimitsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetPermissions(VMSettings.VMSetPermissions request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifySettingsPermission"];
                return response;
            }

            var settings = await this.db.SystemSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new EntitySystemSettings { Id = 1 };
                this.db.SystemSettings.Add(settings);
            }
            settings.CanManageNotesAdministrator = request.CanManageNotesAdministrator;
            settings.CanUseTwoFactorAdministrator = request.CanUseTwoFactorAdministrator;
            settings.CanManageNotesUser = request.CanManageNotesUser;
            settings.CanUseTwoFactorUser = request.CanUseTwoFactorUser;

            await this.db.SaveChangesAsync();
            this.systemSettingsCache.Set(settings);

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["PermissionsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetContentLimits(VMSettings.VMSetContentLimits request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifySettingsPermission"];
                return response;
            }

            int?[] providedValues =
            [
                request.MaxNoteNameCharsAdministrator, request.MaxNoteNameCharsUser,
                request.MaxNoteDescriptionCharsAdministrator, request.MaxNoteDescriptionCharsUser,
                request.MaxNoteTagsCharsAdministrator, request.MaxNoteTagsCharsUser,
                request.MaxNoteDataKbAdministrator, request.MaxNoteDataKbUser,
                request.MaxAttachmentFileSizeKbAdministrator, request.MaxAttachmentFileSizeKbUser,
            ];
            if (providedValues.Any(v => v.HasValue && v.Value <= 0))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["ContentLimitMustBePositive"];
                return response;
            }

            var settings = await this.db.SystemSettings.FirstOrDefaultAsync(s => s.Id == 1);
            if (settings == null)
            {
                settings = new EntitySystemSettings { Id = 1 };
                this.db.SystemSettings.Add(settings);
            }
            settings.MaxNoteNameCharsAdministrator = request.MaxNoteNameCharsAdministrator;
            settings.MaxNoteNameCharsUser = request.MaxNoteNameCharsUser;
            settings.MaxNoteDescriptionCharsAdministrator = request.MaxNoteDescriptionCharsAdministrator;
            settings.MaxNoteDescriptionCharsUser = request.MaxNoteDescriptionCharsUser;
            settings.MaxNoteTagsCharsAdministrator = request.MaxNoteTagsCharsAdministrator;
            settings.MaxNoteTagsCharsUser = request.MaxNoteTagsCharsUser;
            settings.MaxNoteDataKbAdministrator = request.MaxNoteDataKbAdministrator;
            settings.MaxNoteDataKbUser = request.MaxNoteDataKbUser;
            settings.MaxAttachmentFileSizeKbAdministrator = request.MaxAttachmentFileSizeKbAdministrator;
            settings.MaxAttachmentFileSizeKbUser = request.MaxAttachmentFileSizeKbUser;

            // Precomputed once here so NoteService/FolderService only ever compare against a
            // stored value on create/update, instead of recomputing the char->bytes formula each time.
            settings.MaxNoteNameApproxBytesAdministrator = request.MaxNoteNameCharsAdministrator.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteNameCharsAdministrator.Value) : null;
            settings.MaxNoteNameApproxBytesUser = request.MaxNoteNameCharsUser.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteNameCharsUser.Value) : null;
            settings.MaxNoteDescriptionApproxBytesAdministrator = request.MaxNoteDescriptionCharsAdministrator.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteDescriptionCharsAdministrator.Value) : null;
            settings.MaxNoteDescriptionApproxBytesUser = request.MaxNoteDescriptionCharsUser.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteDescriptionCharsUser.Value) : null;
            settings.MaxNoteTagsApproxBytesAdministrator = request.MaxNoteTagsCharsAdministrator.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteTagsCharsAdministrator.Value) : null;
            settings.MaxNoteTagsApproxBytesUser = request.MaxNoteTagsCharsUser.HasValue ? this.contentLimitService.ComputeApproxMaxCiphertextBytes(request.MaxNoteTagsCharsUser.Value) : null;

            await this.db.SaveChangesAsync();
            this.systemSettingsCache.Set(settings);

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["ContentLimitsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }
}
