using System.Net;
using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Attachment;

public interface IAttachmentService
{
    Task<DTOGeneric.DTOResponseApiListData<DTOAttachment.DTOGet>> List(VMAttachment.VMList request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Create(VMAttachment.VMCreate request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Delete(VMAttachment.VMDelete request, HttpContext httpContext);
    Task<(HttpStatusCode StatusCode, string? Message, Stream? Content)> Download(VMAttachment.VMDownload request, HttpContext httpContext);

    // Used by NoteService.Delete: deletes both the note_attachments rows and the physical files
    // for every attachment belonging to any of the given note ids (a note plus its descendants).
    Task DeleteForNotes(IEnumerable<Guid> noteIds);

    // Used by UserService's account-deletion path: same as DeleteForNotes, but scoped to every
    // attachment the user owns directly (via EntityNoteAttachment.UserId), regardless of note ids.
    Task DeleteForUser(Guid userId);
}
