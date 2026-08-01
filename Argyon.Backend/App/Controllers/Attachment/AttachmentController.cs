using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Filters;

namespace Argyon.Backend.App.Controllers.Attachment;

[ApiController]
[Authorize]
[RequireFreshVault]
[Route("api/[controller]")]
public class AttachmentController : ControllerBase
{
    private readonly IAttachmentService thisService;

    public AttachmentController(IAttachmentService attachmentService)
    {
        this.thisService = attachmentService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] VMAttachment.VMList request)
    {
        var response = await this.thisService.List(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromForm] VMAttachment.VMCreate request)
    {
        var response = await this.thisService.Create(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpDelete]
    public async Task<ActionResult> Delete([FromBody] VMAttachment.VMDelete request)
    {
        var response = await this.thisService.Delete(request, this.HttpContext);
        return StatusCode((int)response.StatusCode, response);
    }

    [HttpGet("Download")]
    public async Task<ActionResult> Download([FromQuery] VMAttachment.VMDownload request)
    {
        var (statusCode, message, content) = await this.thisService.Download(request, this.HttpContext);
        if (content == null)
        {
            return StatusCode((int)statusCode, new DTOGeneric.DTOResponseApi { Message = message ?? string.Empty, StatusCode = statusCode });
        }
        return File(content, "application/octet-stream");
    }
}
