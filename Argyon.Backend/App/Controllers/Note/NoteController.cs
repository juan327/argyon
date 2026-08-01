using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Argyon.Backend.App.Shared.Filters;

namespace Argyon.Backend.App.Controllers.Note;

[ApiController]
[Authorize]
[RequireFreshVault]
[Route("api/[controller]")]
public class NoteController : ControllerBase
{
    private readonly ILogger<NoteController> _logger;
    private readonly INoteService thisService;

    public NoteController(ILogger<NoteController> logger, INoteService noteService)
    {
        _logger = logger;
        this.thisService = noteService;
    }

    // SSE streaming: writes the response directly to HttpContext.Response,
    // so it cannot return ActionResult/StatusCode(...) like the other actions.
    [HttpGet]
    public async Task List(CancellationToken cancellationToken)
    {
        await this.thisService.List(this.HttpContext, cancellationToken);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromForm] VMNote.VMCreate request)
    {
        var response = await this.thisService.Create(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut]
    public async Task<ActionResult> Update([FromForm] VMNote.VMUpdate request)
    {
        var response = await this.thisService.Update(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpDelete]
    public async Task<ActionResult> Delete([FromBody] VMNote.VMDelete request)
    {
        var response = await this.thisService.Delete(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPut("SetFavorite")]
    public async Task<ActionResult> SetFavorite([FromBody] VMNote.VMSetFavorite request)
    {
        var response = await this.thisService.SetFavorite(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPost("Import")]
    public async Task<ActionResult> Import([FromBody] VMImport request)
    {
        var response = await this.thisService.Import(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

}