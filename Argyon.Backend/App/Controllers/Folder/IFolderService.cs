using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Folder;

public interface IFolderService
{
    Task<DTOGeneric.DTOResponseApiData<Guid>> Create(VMFolder.VMCreate request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Update(VMFolder.VMUpdate request, HttpContext httpContext);
}