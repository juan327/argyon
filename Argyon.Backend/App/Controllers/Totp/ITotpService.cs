using Argyon.Backend.App.Controllers.User;
using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Totp;

public interface ITotpService
{
    Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOSetup>> Setup(VMTotp.VMSetup request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>> Enable(VMTotp.VMEnable request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Disable(VMTotp.VMDisable request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>> RegenerateRecoveryCodes(VMTotp.VMRegenerateRecoveryCodes request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<bool>> Status(HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>> VerifyLogin(VMTotp.VMVerifyLogin request, HttpContext httpContext);
}
