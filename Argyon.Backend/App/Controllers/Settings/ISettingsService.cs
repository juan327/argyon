using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Settings;

public interface ISettingsService
{
    Task<DTOGeneric.DTOResponseApiData<DTOSettings.DTOSystemSettings>> Get();
    Task<DTOGeneric.DTOResponseApi> SetRegistrationEnabled(VMSettings.VMSetRegistrationEnabled request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetLimits(VMSettings.VMSetLimits request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetPermissions(VMSettings.VMSetPermissions request, HttpContext httpContext);
    Task<DTOGeneric.DTOResponseApi> SetContentLimits(VMSettings.VMSetContentLimits request, HttpContext httpContext);
}
