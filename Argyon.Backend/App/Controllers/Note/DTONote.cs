namespace Argyon.Backend.App.Controllers.Note;

public class DTONote
{
    public class DTOGet
    {
        public Guid Id { get; set; }
        public bool IsFolder { get; set; }
        public bool IsFavorite { get; set; }
        public bool HasAttachments { get; set; }
        public string Name { get; set; }
        public byte[] NameIv { get; set; }
        public string? Data { get; set; }
        public byte[]? DataIv { get; set; }
        public string? Tags { get; set; }
        public byte[]? TagsIv { get; set; }
        public string? Description { get; set; }
        public byte[]? DescriptionIv { get; set; }
        public Guid? ParentId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class DTOImportResult
    {
        public int ImportedCount { get; set; }
        public List<string> FailedTempIds { get; set; } = new List<string>();
    }
}