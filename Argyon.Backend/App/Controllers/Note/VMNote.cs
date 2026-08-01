namespace Argyon.Backend.App.Controllers.Note;

public class VMNote
{
    public class VMCreate
    {
        public Guid? ParentNoteId { get; set; }
        public string Name { get; set; }
        public byte[] NameIv { get; set; }
        public string Data { get; set; }
        public byte[]? DataIv { get; set; }
        public string? Tags { get; set; }
        public byte[]? TagsIv { get; set; }
        public string? Description { get; set; }
        public byte[]? DescriptionIv { get; set; }
        public bool IsFavorite { get; set; }
    }

    public class VMUpdate: VMCreate
    {
        public Guid NoteId { get; set; }
    }


    public class VMDelete
    {
        public Guid NoteId { get; set; }
        public string AuthHash { get; set; }
    }

    public class VMSetFavorite
    {
        public Guid NoteId { get; set; }
        public bool IsFavorite { get; set; }
    }
}