using System.Data.Common;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.Scopeds;
using Argyon.Backend.App.Shared.Services;
using Argyon.Backend.App.Shared.IServices;
using Argyon.Backend.App.Controllers.Attachment;

namespace Argyon.Backend.App.Controllers.Note;

public class NoteService : INoteService
{
    private const int SyncBatchSize = 1000;
    private readonly DataContext db;
    private readonly IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> jsonOptions;
    private readonly INoteLimitService noteLimitService;
    private readonly IPermissionService permissionService;
    private readonly IContentLimitService contentLimitService;
    private readonly IAttachmentService attachmentService;
    private readonly IStringLocalizer<SharedResource> localizer;
    private readonly PasswordService passwordService = new PasswordService();

    public NoteService(DataContext _db, IConfiguration _configuration, IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> _jsonOptions, INoteLimitService _noteLimitService, IPermissionService _permissionService, IContentLimitService _contentLimitService, IAttachmentService _attachmentService, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.jsonOptions = _jsonOptions;
        this.noteLimitService = _noteLimitService;
        this.permissionService = _permissionService;
        this.contentLimitService = _contentLimitService;
        this.attachmentService = _attachmentService;
        this.localizer = _localizer;
    }

    public async Task List(HttpContext httpContext, CancellationToken cancellationToken)
    {
        var jsonSerializerOptions = this.jsonOptions.Value.JsonSerializerOptions;
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                httpContext.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                await httpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi { Message = this.localizer["UserNotAuthenticated"] }, cancellationToken);
                return;
            }

            var findUser = this.db.Users.Any(u => u.Id == userId.Value);
            if (findUser == false)
            {
                httpContext.Response.StatusCode = (int)HttpStatusCode.NotFound;
                await httpContext.Response.WriteAsJsonAsync(new DTOGeneric.DTOResponseApi { Message = this.localizer["UserNotFound"] }, cancellationToken);
                return;
            }

            httpContext.Response.StatusCode = (int)HttpStatusCode.OK;
            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";

            // The query is paginated by SyncBatchSize instead of fetching everything in a single query,
            // to avoid overloading the DB with a heavy read when the user has many notes.
            var offset = 0;
            while (true)
            {
                var batch = await this.db.Notes.AsNoTracking()
                    .Where(n => n.UserId == userId.Value)
                    .OrderByDescending(n => n.IsFolder)
                    .ThenByDescending(n => n.UpdatedAt)
                    .ThenBy(n => n.Id)
                    .Skip(offset)
                    .Take(SyncBatchSize)
                    .Select(n => new DTONote.DTOGet
                    {
                        Id = n.Id,
                        IsFolder = n.IsFolder,
                        IsFavorite = n.IsFavorite,
                        HasAttachments = n.HasAttachments,
                        Name = n.Name,
                        NameIv = n.NameIv,
                        Data = n.Data,
                        DataIv = n.DataIv,
                        Tags = n.Tags,
                        TagsIv = n.TagsIv,
                        Description = n.Description,
                        DescriptionIv = n.DescriptionIv,
                        ParentId = n.ParentId,
                        CreatedAt = n.CreatedAt,
                        UpdatedAt = n.UpdatedAt,
                    })
                    .ToListAsync(cancellationToken);

                if (batch.Count == 0)
                {
                    break;
                }

                await WriteSyncBatch(httpContext.Response, batch, jsonSerializerOptions, cancellationToken);

                if (batch.Count < SyncBatchSize)
                {
                    break;
                }

                offset += SyncBatchSize;
            }

            await httpContext.Response.WriteAsync("event: done\ndata: {}\n\n", cancellationToken);
            await httpContext.Response.Body.FlushAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // The client closed the connection (e.g. it relaunched the sync after creating/deleting a note): not an error.
        }
        catch (Exception ex)
        {
            try
            {
                var errorJson = JsonSerializer.Serialize(new DTOGeneric.DTOResponseApi { Message = this.localizer["InternalServerError"] }, jsonSerializerOptions);
                await httpContext.Response.WriteAsync($"event: sync-error\ndata: {errorJson}\n\n", cancellationToken);
                await httpContext.Response.Body.FlushAsync(cancellationToken);
            }
            catch
            {
                // The connection has already dropped: there is no one to notify.
            }
        }
    }

    // Named "sync-error" (not "error"): if the SSE event were called "error", the browser would
    // dispatch it through the same channel EventSource.onerror uses for real connection failures,
    // mixing a business error with a connection drop.
    private static async Task WriteSyncBatch(HttpResponse response, List<DTONote.DTOGet> batch, JsonSerializerOptions jsonSerializerOptions, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(batch, jsonSerializerOptions);
        await response.WriteAsync($"event: batch\ndata: {json}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    public async Task<DTOGeneric.DTOResponseApiData<Guid>> Create(VMNote.VMCreate request, HttpContext httpContext)
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

            var limitError = await this.noteLimitService.CheckLimit(caller, isFolder: false);
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

            if (string.IsNullOrEmpty(request.Name))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["NameRequired"];
                return response;
            }

            var contentLimitError = await this.contentLimitService.ValidateContent(caller, request.Name, request.Description, request.Tags, request.Data);
            if (contentLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = contentLimitError;
                return response;
            }

            var newNote = new EntityNote
            {
                Name = request.Name,
                NameIv = request.NameIv,
                Data = request.Data,
                DataIv = request.DataIv,
                UserId = userId.Value,
                Tags = request.Tags,
                TagsIv = request.TagsIv,
                Description = request.Description,
                DescriptionIv = request.DescriptionIv,
                IsFavorite = request.IsFavorite,
            };

            newNote.ParentId = existParentNote?.Id;
            this.db.Notes.Add(newNote);
            await this.db.SaveChangesAsync();

            response.Data = newNote.Id;
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["NoteCreated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Update(VMNote.VMUpdate request, HttpContext httpContext)
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

            var findNote = await this.db.Notes.FirstOrDefaultAsync(n => n.Id == request.NoteId);
            if (findNote == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            var existParentNote = await this.db.Notes.FirstOrDefaultAsync(f => f.Id == request.ParentNoteId && f.UserId == userId.Value && f.IsFolder);
            if (request.ParentNoteId != null && existParentNote == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["FolderNotFound"];
                return response;
            }

            var contentLimitError = await this.contentLimitService.ValidateContent(caller, request.Name, request.Description, request.Tags, request.Data);
            if (contentLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = contentLimitError;
                return response;
            }

            var dateTimeUtcNow = DateTime.UtcNow;

            findNote.Name = request.Name;
            findNote.NameIv = request.NameIv;
            findNote.Data = request.Data;
            findNote.DataIv = request.DataIv;
            findNote.Tags = request.Tags;
            findNote.TagsIv = request.TagsIv;
            findNote.Description = request.Description;
            findNote.DescriptionIv = request.DescriptionIv;
            findNote.IsFavorite = request.IsFavorite;
            findNote.ParentId = existParentNote?.Id;
            findNote.UpdatedAt = dateTimeUtcNow;

            if (existParentNote != null)
            {
                existParentNote.UpdatedAt = dateTimeUtcNow;
                this.db.Notes.Update(existParentNote);
            }

            this.db.Notes.Update(findNote);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["NoteUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetFavorite(VMNote.VMSetFavorite request, HttpContext httpContext)
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

            var findNote = await this.db.Notes.FindAsync(request.NoteId);
            if (findNote == null || findNote.UserId != userId.Value)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            findNote.IsFavorite = request.IsFavorite;
            findNote.UpdatedAt = DateTime.UtcNow;

            this.db.Notes.Update(findNote);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["NoteUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Delete(VMNote.VMDelete request, HttpContext httpContext)
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

            if (string.IsNullOrEmpty(request.AuthHash) || this.passwordService.VerifyPassword(request.AuthHash, caller.AuthHash) == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["IncorrectPassword"];
                return response;
            }

            var findNote = await this.db.Notes.FindAsync(request.NoteId);
            if (findNote == null || findNote.UserId != userId.Value)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            // ParentId only stores the immediate parent, so descendants at any depth are found
            // by walking the user's notes in memory (recursive CTEs aren't practical with EF Core + SQLite).
            var childrenByParent = await this.db.Notes.AsNoTracking()
                .Where(n => n.UserId == userId.Value && n.ParentId != null)
                .Select(n => new { n.Id, ParentId = n.ParentId!.Value })
                .ToListAsync();
            var childrenLookup = childrenByParent.ToLookup(n => n.ParentId, n => n.Id);

            var descendantIds = new List<Guid>();
            var pending = new Queue<Guid>();
            pending.Enqueue(findNote.Id);
            while (pending.Count > 0)
            {
                foreach (var childId in childrenLookup[pending.Dequeue()])
                {
                    descendantIds.Add(childId);
                    pending.Enqueue(childId);
                }
            }

            if (descendantIds.Count > 0)
            {
                var listChildrens = await this.db.Notes.Where(n => descendantIds.Contains(n.Id)).ToListAsync();
                this.db.Notes.RemoveRange(listChildrens);
            }

            this.db.Notes.Remove(findNote);
            await this.db.SaveChangesAsync();

            // Only unlink the attachments (DB rows + physical files) once the notes themselves are gone.
            await this.attachmentService.DeleteForNotes(descendantIds.Append(findNote.Id));

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["NoteDeleted"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTONote.DTOImportResult>> Import(VMImport request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTONote.DTOImportResult>();
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

            var result = new DTONote.DTOImportResult();
            if (request.Items == null || request.Items.Count == 0)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["NoItemsToImport"];
                return response;
            }

            var existTargetParent = request.TargetParentId == null
                ? null
                : await this.db.Notes.FirstOrDefaultAsync(f => f.Id == request.TargetParentId && f.UserId == userId.Value && f.IsFolder);
            if (request.TargetParentId != null && existTargetParent == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["FolderNotFound"];
                return response;
            }

            // First pass: create all entities (each already with its real Id,
            // assigned in the constructor) without resolving the folder hierarchy yet.
            var itemsByTempId = new Dictionary<string, VMImportItem>();
            var entitiesByTempId = new Dictionary<string, EntityNote>();
            foreach (var item in request.Items)
            {
                if (string.IsNullOrEmpty(item.TempId) || itemsByTempId.ContainsKey(item.TempId) || string.IsNullOrEmpty(item.Name))
                {
                    result.FailedTempIds.Add(item.TempId ?? string.Empty);
                    continue;
                }

                itemsByTempId[item.TempId] = item;
                entitiesByTempId[item.TempId] = new EntityNote
                {
                    IsFolder = item.IsFolder,
                    Name = item.Name,
                    NameIv = item.NameIv,
                    Data = item.IsFolder ? null : item.Data,
                    DataIv = item.IsFolder ? null : item.DataIv,
                    Tags = item.Tags,
                    TagsIv = item.TagsIv,
                    Description = item.Description,
                    DescriptionIv = item.DescriptionIv,
                    UserId = userId.Value,
                };
            }

            var notesToAdd = entitiesByTempId.Values.Count(e => e.IsFolder == false);
            var foldersToAdd = entitiesByTempId.Values.Count(e => e.IsFolder == true);
            var notesLimitError = await this.noteLimitService.CheckLimit(caller, isFolder: false, itemsToAdd: notesToAdd);
            var foldersLimitError = await this.noteLimitService.CheckLimit(caller, isFolder: true, itemsToAdd: foldersToAdd);
            if (notesLimitError != null || foldersLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = notesLimitError ?? foldersLimitError!;
                return response;
            }

            // Second pass: resolve each item's immediate parent. Since every entity's Id already
            // exists in memory, there is no need to save the parents first: everything is
            // resolved in a single SaveChanges. A folder that (transitively) parents itself is
            // imported as root (or under TargetParentId, if given), since ParentId alone can't
            // represent a cycle. Any item that doesn't resolve to a folder within this batch
            // (a true root item, or one referencing a folder outside the batch) falls back to
            // TargetParentId as well, so the whole import lands under the chosen folder.
            foreach (var (tempId, item) in itemsByTempId)
            {
                if (item.ParentTempId == null ||
                    !entitiesByTempId.TryGetValue(item.ParentTempId, out var parentEntity) ||
                    !itemsByTempId.TryGetValue(item.ParentTempId, out var parentItem) ||
                    parentItem.IsFolder == false)
                {
                    entitiesByTempId[tempId].ParentId = existTargetParent?.Id;
                    continue;
                }

                var visiting = new HashSet<string> { tempId };
                var ancestorTempId = item.ParentTempId;
                var isCircular = false;
                while (ancestorTempId != null && itemsByTempId.TryGetValue(ancestorTempId, out var ancestorItem))
                {
                    if (visiting.Add(ancestorTempId) == false)
                    {
                        isCircular = true;
                        break;
                    }
                    ancestorTempId = ancestorItem.ParentTempId;
                }

                entitiesByTempId[tempId].ParentId = isCircular == false ? parentEntity.Id : existTargetParent?.Id;
            }

            this.db.Notes.AddRange(entitiesByTempId.Values);
            await this.db.SaveChangesAsync();

            result.ImportedCount = entitiesByTempId.Count;
            response.Data = result;
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["ImportCompleted"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

}
