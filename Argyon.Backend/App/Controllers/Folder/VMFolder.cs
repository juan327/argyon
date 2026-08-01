namespace Argyon.Backend.App.Controllers.Folder;

public class VMFolder
{
    public class VMCreate
    {
        public Guid? ParentNoteId { get; set; }
        public string Name { get; set; }
        public byte[] NameIv { get; set; }
        public string? Description { get; set; }
        public byte[]? DescriptionIv { get; set; }
        public string? Tags { get; set; }
        public byte[]? TagsIv { get; set; }
        public bool IsFavorite { get; set; }
    }

    public class VMUpdate: VMCreate
    {
        public Guid NoteId { get; set; }
    }
}