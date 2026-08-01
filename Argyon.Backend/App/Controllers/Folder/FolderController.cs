using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Argyon.Backend.App.Shared.Filters;

namespace Argyon.Backend.App.Controllers.Folder;

[ApiController]
[Authorize]
[RequireFreshVault]
[Route("api/[controller]")]
public class FolderController : ControllerBase
{
    private readonly ILogger<FolderController> _logger;
    private readonly IFolderService thisService;

    public FolderController(ILogger<FolderController> logger, IFolderService folderService)
    {
        _logger = logger;
        this.thisService = folderService;
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromForm] VMFolder.VMCreate request)
    {
        var response = await this.thisService.Create(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut]
    public async Task<ActionResult> Update([FromForm] VMFolder.VMUpdate request)
    {
        var response = await this.thisService.Update(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

}