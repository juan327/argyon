using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Argyon.Backend.App.Controllers.Info;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{
    private readonly IInfoService thisService;

    public InfoController(IInfoService infoService)
    {
        this.thisService = infoService;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var response = await this.thisService.Get();
        return StatusCode((int)response.StatusCode, response);
    }
}
