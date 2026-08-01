using System.Net;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Controllers.Attachment;

public class AttachmentService : IAttachmentService
{
    private readonly DataContext db;
    private readonly IPermissionService permissionService;
    private readonly IContentLimitService contentLimitService;
    private readonly IStringLocalizer<SharedResource> localizer;
    private readonly string attachmentsRootDirectory = Path.Combine(AppContext.BaseDirectory, "Data", "Attachments");

    public AttachmentService(DataContext _db, IPermissionService _permissionService, IContentLimitService _contentLimitService, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.permissionService = _permissionService;
        this.contentLimitService = _contentLimitService;
        this.localizer = _localizer;
    }

    private string ResolveAbsolutePath(string relativePath)
    {
        return Path.Combine(AppContext.BaseDirectory, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }

    public async Task<DTOGeneric.DTOResponseApiListData<DTOAttachment.DTOGet>> List(VMAttachment.VMList request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiListData<DTOAttachment.DTOGet>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findNote = await this.db.Notes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == request.NoteId);
            if (findNote == null || findNote.UserId != userId.Value || findNote.IsFolder)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            response.Data = await this.db.NoteAttachments.AsNoTracking()
                .Where(a => a.NoteId == request.NoteId)
                .OrderBy(a => a.CreatedAt)
                .Select(a => new DTOAttachment.DTOGet
                {
                    Id = a.Id,
                    Name = a.Name,
                    NameIv = a.NameIv,
                    ContentIv = a.ContentIv,
                    SizeBytes = a.SizeBytes,
                    CreatedAt = a.CreatedAt,
                })
                .ToListAsync();
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Create(VMAttachment.VMCreate request, HttpContext httpContext)
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
            if (findNote == null || findNote.UserId != userId.Value || findNote.IsFolder)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            if (request.File == null || request.File.Length == 0)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["AttachmentFileRequired"];
                return response;
            }

            var sizeLimitError = await this.contentLimitService.ValidateAttachmentSize(caller, request.File.Length);
            if (sizeLimitError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = sizeLimitError;
                return response;
            }

            var id = Guid.NewGuid();
            var relativePath = $"Data/Attachments/{id}";
            var absolutePath = this.ResolveAbsolutePath(relativePath);

            if (Directory.Exists(this.attachmentsRootDirectory) == false)
            {
                Directory.CreateDirectory(this.attachmentsRootDirectory);
            }

            // Streamed straight to disk (no in-memory buffering) -- the bytes are already the
            // client's ciphertext, the server never decrypts or inspects them.
            using (var fileStream = File.Create(absolutePath))
            {
                await request.File.CopyToAsync(fileStream);
            }

            try
            {
                this.db.NoteAttachments.Add(new EntityNoteAttachment
                {
                    Id = id,
                    NoteId = findNote.Id,
                    UserId = userId.Value,
                    Name = request.Name,
                    NameIv = request.NameIv,
                    ContentIv = request.ContentIv,
                    SizeBytes = request.File.Length,
                    RelativePath = relativePath,
                });
                findNote.HasAttachments = true;
                findNote.UpdatedAt = DateTime.UtcNow;

                this.db.Notes.Update(findNote);
                await this.db.SaveChangesAsync();
            }
            catch
            {
                // The DB write failed after the file was already on disk: best-effort cleanup so we
                // don't leak the ciphertext blob. An orphan file surviving this (e.g. process crash)
                // is an acceptable residual for this dev app -- a dangling DB reference is not.
                try { File.Delete(absolutePath); } catch { }
                throw;
            }

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["AttachmentCreated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Delete(VMAttachment.VMDelete request, HttpContext httpContext)
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
            if (findNote == null || findNote.UserId != userId.Value || findNote.IsFolder)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["NoteNotFound"];
                return response;
            }

            var findAttachment = await this.db.NoteAttachments.FirstOrDefaultAsync(a => a.Id == request.AttachmentId && a.NoteId == request.NoteId);
            if (findAttachment == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["AttachmentNotFound"];
                return response;
            }

            var hasOtherAttachments = await this.db.NoteAttachments.AnyAsync(a => a.NoteId == findNote.Id && a.Id != findAttachment.Id);

            this.db.NoteAttachments.Remove(findAttachment);
            findNote.HasAttachments = hasOtherAttachments;
            findNote.UpdatedAt = DateTime.UtcNow;

            this.db.Notes.Update(findNote);
            await this.db.SaveChangesAsync();

            // Only unlink the physical file once the DB no longer references it.
            try { File.Delete(this.ResolveAbsolutePath(findAttachment.RelativePath)); } catch { }

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["AttachmentDeleted"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<(HttpStatusCode StatusCode, string? Message, Stream? Content)> Download(VMAttachment.VMDownload request, HttpContext httpContext)
    {
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                return (HttpStatusCode.Unauthorized, this.localizer["UserNotAuthenticated"], null);
            }

            var findNote = await this.db.Notes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == request.NoteId);
            if (findNote == null || findNote.UserId != userId.Value || findNote.IsFolder)
            {
                return (HttpStatusCode.NotFound, this.localizer["NoteNotFound"], null);
            }

            var findAttachment = await this.db.NoteAttachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == request.AttachmentId && a.NoteId == request.NoteId);
            if (findAttachment == null)
            {
                return (HttpStatusCode.NotFound, this.localizer["AttachmentNotFound"], null);
            }

            var absolutePath = this.ResolveAbsolutePath(findAttachment.RelativePath);
            if (File.Exists(absolutePath) == false)
            {
                return (HttpStatusCode.NotFound, this.localizer["AttachmentNotFound"], null);
            }

            // No Content-Disposition filename is set: the server never has the plaintext name --
            // the client already knows it (decrypted) from the preceding List call.
            Stream content = new FileStream(absolutePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return (HttpStatusCode.OK, null, content);
        }
        catch (Exception)
        {
            return (HttpStatusCode.InternalServerError, this.localizer["InternalServerError"], null);
        }
    }

    public async Task DeleteForNotes(IEnumerable<Guid> noteIds)
    {
        var noteIdList = noteIds as ICollection<Guid> ?? noteIds.ToList();
        if (noteIdList.Count == 0)
        {
            return;
        }

        var attachments = await this.db.NoteAttachments.Where(a => noteIdList.Contains(a.NoteId)).ToListAsync();
        if (attachments.Count == 0)
        {
            return;
        }

        this.db.NoteAttachments.RemoveRange(attachments);
        await this.db.SaveChangesAsync();

        foreach (var attachment in attachments)
        {
            try { File.Delete(this.ResolveAbsolutePath(attachment.RelativePath)); } catch { }
        }
    }

    public async Task DeleteForUser(Guid userId)
    {
        var attachments = await this.db.NoteAttachments.Where(a => a.UserId == userId).ToListAsync();
        if (attachments.Count == 0)
        {
            return;
        }

        this.db.NoteAttachments.RemoveRange(attachments);
        await this.db.SaveChangesAsync();

        foreach (var attachment in attachments)
        {
            try { File.Delete(this.ResolveAbsolutePath(attachment.RelativePath)); } catch { }
        }
    }
}
