namespace Argyon.Backend.App.Controllers.Attachment;

public class VMAttachment
{
    public class VMList
    {
        public Guid NoteId { get; set; }
    }

    public class VMCreate
    {
        public Guid NoteId { get; set; }
        public string Name { get; set; }
        public byte[] NameIv { get; set; }
        public byte[] ContentIv { get; set; }
        public IFormFile File { get; set; }
    }

    public class VMDelete
    {
        public Guid NoteId { get; set; }
        public Guid AttachmentId { get; set; }
    }

    public class VMDownload
    {
        public Guid NoteId { get; set; }
        public Guid AttachmentId { get; set; }
    }
}
