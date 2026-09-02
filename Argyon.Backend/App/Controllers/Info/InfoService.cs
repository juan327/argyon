using System.Net;
using System.Reflection;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.DTO;

namespace Argyon.Backend.App.Controllers.Info;

public class InfoService : IInfoService
{
    private readonly IStringLocalizer<SharedResource> localizer;

    public InfoService(IStringLocalizer<SharedResource> _localizer)
    {
        this.localizer = _localizer;
    }

    public Task<DTOGeneric.DTOResponseApiData<DTOInfo.DTOVersion>> Get()
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOInfo.DTOVersion>();
        try
        {
            var assemblyVersion = Assembly.GetExecutingAssembly().GetName().Version;
            var version = assemblyVersion is null ? "0.0.0" : $"{assemblyVersion.Major}.{assemblyVersion.Minor}.{assemblyVersion.Build}";
            response.Data = new DTOInfo.DTOVersion { Version = version };
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return Task.FromResult(response);
    }
}
