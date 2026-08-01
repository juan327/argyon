using System.Data.Common;
using System.Net;
using System.Security.Cryptography;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.Scopeds;
using Argyon.Backend.App.Shared.Services;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Controllers.Folder;

public class FolderService : IFolderService
{
    private readonly DataContext db;
    private readonly INoteLimitService noteLimitService;
    private readonly IPermissionService permissionService;
    private readonly IContentLimitService contentLimitService;
    private readonly IStringLocalizer<SharedResource> localizer;

    public FolderService(DataContext _db, IConfiguration _configuration, INoteLimitService _noteLimitService, IPermissionService _permissionService, IContentLimitService _contentLimitService, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.noteLimitService = _noteLimitService;
        this.permissionService = _permissionService;
        this.contentLimitService = _contentLimitService;
        this.localizer = _localizer;
    }

    public async Task<DTOGeneric.DTOResponseApiData<Guid>> Create(VMFolder.VMCreate request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<Guid>();
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

            if (await this.permissionService.HasPermission(caller, PermissionCode.ManageNotes) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoManageNotesPermission"];
                return response;
            }

            var limitError = await this.noteLimitService.CheckLimit(caller, isFolder: true);
            if (limitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = limitError;
                return response;
            }

            var existParentNote = await this.db.Notes.FirstOrDefaultAsync(f => f.Id == request.ParentNoteId && f.UserId == userId.Value && f.IsFolder);
            if (request.ParentNoteId != null && existParentNote == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["FolderNotFound"];
                return response;
            }

            var contentLimitError = await this.contentLimitService.ValidateContent(caller, request.Name, request.Description, request.Tags, dataCiphertext: null);
            if (contentLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = contentLimitError;
                return response;
            }

            var newFolder = new EntityNote
            {
                IsFolder = true,
                Name = request.Name,
                NameIv = request.NameIv,
                Description = request.Description,
                DescriptionIv = request.DescriptionIv,
                UserId = userId.Value,
                Tags = request.Tags,
                TagsIv = request.TagsIv,
                IsFavorite = request.IsFavorite,
            };

            newFolder.ParentId = existParentNote?.Id;
            this.db.Notes.Add(newFolder);
            await this.db.SaveChangesAsync();

            response.Data = newFolder.Id;
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["FolderCreated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Update(VMFolder.VMUpdate request, HttpContext httpContext)
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

            if (await this.permissionService.HasPermission(caller, PermissionCode.ManageNotes) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoManageNotesPermission"];
                return response;
            }

            var findFolder = await this.db.Notes.FirstOrDefaultAsync(f => f.Id == request.NoteId && f.IsFolder);
            if (findFolder == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["FolderNotFound"];
                return response;
            }

            var existParentNote = await this.db.Notes.FirstOrDefaultAsync(f => f.Id == request.ParentNoteId && f.UserId == userId.Value && f.IsFolder);
            if (request.ParentNoteId != null && existParentNote == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["ParentFolderNotFound"];
                return response;
            }

            var contentLimitError = await this.contentLimitService.ValidateContent(caller, request.Name, request.Description, request.Tags, dataCiphertext: null);
            if (contentLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = contentLimitError;
                return response;
            }

            findFolder.Name = request.Name;
            findFolder.NameIv = request.NameIv;
            findFolder.Description = request.Description;
            findFolder.DescriptionIv = request.DescriptionIv;
            findFolder.Tags = request.Tags;
            findFolder.TagsIv = request.TagsIv;
            findFolder.IsFavorite = request.IsFavorite;
            findFolder.ParentId = existParentNote?.Id;

            this.db.Notes.Update(findFolder);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["FolderUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

}
