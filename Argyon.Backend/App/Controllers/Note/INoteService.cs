using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Note;

public interface INoteService
{
    Task List(HttpContext httpContext, CancellationToken cancellationToken);
    Task<DTOGeneric.DTOResponseApiData<Guid>> Create(VMNote.VMCreate request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Update(VMNote.VMUpdate request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Delete(VMNote.VMDelete request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetFavorite(VMNote.VMSetFavorite request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTONote.DTOImportResult>> Import(VMImport request, HttpContext httpContext);
}