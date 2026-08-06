using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.User;

public interface IUserService
{
    Task<DTOGeneric.DTOResponseApi> Register(VMUser.VMRegister request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOPreloginInfo>> Prelogin(VMUser.VMPrelogin request);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOLoginResponse>> Login(VMUser.VMLogin request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Logout(HttpRequest httpRequest, HttpResponse httpResponse);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTORefreshResponse>> Refresh(HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>> ValidatePassword(VMUser.VMValidatePassword request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> ChangePassword(VMUser.VMChangePassword request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> TouchVault(HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOMe>> Me(HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApiPagedListData<DTOUser.DTOUserList>> List(VMUser.VMList request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> ChangeRole(VMUser.VMChangeRole request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Delete(VMUser.VMDelete request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> Create(VMUser.VMCreate request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetBlocked(VMUser.VMSetBlocked request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetLimits(VMUser.VMSetLimits request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetPermissions(VMUser.VMSetPermissions request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetContentLimits(VMUser.VMSetContentLimits request, HttpContext httpContext);
}