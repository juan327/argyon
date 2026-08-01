using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Argyon.Backend.App.Shared.Filters;

namespace Argyon.Backend.App.Controllers.Totp;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TotpController : ControllerBase
{
    private readonly ITotpService thisService;

    public TotpController(ITotpService totpService)
    {
        this.thisService = totpService;
    }

    [RequireFreshVault]
    [HttpPost("Setup")]
    public async Task<ActionResult> Setup([FromBody] VMTotp.VMSetup request)
    {
        var response = await this.thisService.Setup(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [RequireFreshVault]
    [HttpPost("Enable")]
    public async Task<ActionResult> Enable([FromBody] VMTotp.VMEnable request)
    {
        var response = await this.thisService.Enable(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [RequireFreshVault]
    [HttpPost("Disable")]
    public async Task<ActionResult> Disable([FromBody] VMTotp.VMDisable request)
    {
        var response = await this.thisService.Disable(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [RequireFreshVault]
    [HttpPost("RegenerateRecoveryCodes")]
    public async Task<ActionResult> RegenerateRecoveryCodes([FromBody] VMTotp.VMRegenerateRecoveryCodes request)
    {
        var response = await this.thisService.RegenerateRecoveryCodes(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpGet("Status")]
    public async Task<ActionResult> Status()
    {
        var response = await this.thisService.Status(this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [AllowAnonymous]
    [HttpPost("VerifyLogin")]
    public async Task<ActionResult> VerifyLogin([FromBody] VMTotp.VMVerifyLogin request)
    {
        var response = await this.thisService.VerifyLogin(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }
}
