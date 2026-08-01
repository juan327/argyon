using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Argyon.Backend.App.Controllers.Settings;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService thisService;

    public SettingsController(ISettingsService settingsService)
    {
        this.thisService = settingsService;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var response = await this.thisService.Get();
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("Registration")]
    public async Task<ActionResult> SetRegistrationEnabled([FromBody] VMSettings.VMSetRegistrationEnabled request)
    {
        var response = await this.thisService.SetRegistrationEnabled(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("Limits")]
    public async Task<ActionResult> SetLimits([FromBody] VMSettings.VMSetLimits request)
    {
        var response = await this.thisService.SetLimits(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("Permissions")]
    public async Task<ActionResult> SetPermissions([FromBody] VMSettings.VMSetPermissions request)
    {
        var response = await this.thisService.SetPermissions(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("ContentLimits")]
    public async Task<ActionResult> SetContentLimits([FromBody] VMSettings.VMSetContentLimits request)
    {
        var response = await this.thisService.SetContentLimits(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }
}
