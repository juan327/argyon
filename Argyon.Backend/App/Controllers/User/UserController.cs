using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Argyon.Backend.App.Shared.Filters;

namespace Argyon.Backend.App.Controllers.User;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly ILogger<UserController> _logger;
    private readonly IUserService thisService;

    public UserController(ILogger<UserController> logger, IUserService userService)
    {
        _logger = logger;
        this.thisService = userService;
    }

    [AllowAnonymous]
    [HttpPost("Register")]
    public async Task<ActionResult> Register([FromBody] VMUser.VMRegister request)
    {
        var response = await this.thisService.Register(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [AllowAnonymous]
    [HttpPost("Prelogin")]
    public async Task<ActionResult> Prelogin([FromBody] VMUser.VMPrelogin request)
    {
        var response = await this.thisService.Prelogin(request);
        return StatusCode((int)response.StatusCode, response);
    }

    [AllowAnonymous]
    [HttpPost("Login")]
    public async Task<ActionResult> Login([FromBody] VMUser.VMLogin request)
    {
        var response = await this.thisService.Login(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpGet("Ping")]
    public ActionResult Ping()
    {
        return Ok("Pong");
    }

    [HttpPost("Logout")]
    public async Task<ActionResult> Logout()
    {
        var response = await this.thisService.Logout(this.HttpContext.Request, this.HttpContext.Response);
        return StatusCode((int)response.StatusCode, response);
    }

    // Anonymous: the access token may already be expired by the time this is called, only the
    // refresh_token cookie is required.
    [AllowAnonymous]
    [HttpPost("Refresh")]
    public async Task<ActionResult> Refresh()
    {
        var response = await this.thisService.Refresh(this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPost("ValidatePassword")]
    public async Task<ActionResult> ValidatePassword([FromBody] VMUser.VMValidatePassword request)
    {
        var response = await this.thisService.ValidatePassword(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [RequireFreshVault]
    [HttpPost("ChangePassword")]
    public async Task<ActionResult> ChangePassword([FromBody] VMUser.VMChangePassword request)
    {
        var response = await this.thisService.ChangePassword(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    // Heartbeat called by the frontend while the vault is unlocked and the tab is visible.
    // [RequireFreshVault] ensures this can only extend an already-fresh session.
    [RequireFreshVault]
    [HttpPost("TouchVault")]
    public async Task<ActionResult> TouchVault()
    {
        var response = await this.thisService.TouchVault(this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpGet("Me")]
    public async Task<ActionResult> Me()
    {
        var response = await this.thisService.Me(this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] VMUser.VMList request)
    {
        var response = await this.thisService.List(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("ChangeRole")]
    public async Task<ActionResult> ChangeRole([FromBody] VMUser.VMChangeRole request)
    {
        var response = await this.thisService.ChangeRole(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpDelete]
    public async Task<ActionResult> Delete([FromBody] VMUser.VMDelete request)
    {
        var response = await this.thisService.Delete(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] VMUser.VMCreate request)
    {
        var response = await this.thisService.Create(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("SetBlocked")]
    public async Task<ActionResult> SetBlocked([FromBody] VMUser.VMSetBlocked request)
    {
        var response = await this.thisService.SetBlocked(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("SetLimits")]
    public async Task<ActionResult> SetLimits([FromBody] VMUser.VMSetLimits request)
    {
        var response = await this.thisService.SetLimits(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("SetPermissions")]
    public async Task<ActionResult> SetPermissions([FromBody] VMUser.VMSetPermissions request)
    {
        var response = await this.thisService.SetPermissions(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("SetContentLimits")]
    public async Task<ActionResult> SetContentLimits([FromBody] VMUser.VMSetContentLimits request)
    {
        var response = await this.thisService.SetContentLimits(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }
}