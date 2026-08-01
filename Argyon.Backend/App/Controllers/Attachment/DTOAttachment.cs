namespace Argyon.Backend.App.Controllers.Attachment;

public class DTOAttachment
{
    public class DTOGet
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public byte[] NameIv { get; set; }
        public byte[] ContentIv { get; set; }
        public long SizeBytes { get; set; }
        public DateTime CreatedAt { get; set; }
        // RelativePath is intentionally not exposed here -- server-internal only.
    }
}
