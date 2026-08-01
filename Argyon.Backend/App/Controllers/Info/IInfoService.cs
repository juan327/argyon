using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Info;

public interface IInfoService
{
    Task<DTOGeneric.DTOResponseApiData<DTOInfo.DTOVersion>> Get();
}
