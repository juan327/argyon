namespace Argyon.Backend.App.Controllers.Note;

public class VMImport
{
    public List<VMImportItem> Items { get; set; }
    // Existing folder (already in the database, not part of Items) that items
    // without a resolvable parent within this batch should be imported into.
    // Null means the vault root.
    public Guid? TargetParentId { get; set; }
}

public class VMImportItem
{
    // Temporary Id assigned by the client (for example the original Id of the
    // exported file), only used to resolve the hierarchy within this batch.
    public string TempId { get; set; }
    public string? ParentTempId { get; set; }
    public bool IsFolder { get; set; }
    public string Name { get; set; }
    public byte[] NameIv { get; set; }
    public string? Data { get; set; }
    public byte[]? DataIv { get; set; }
    public string? Tags { get; set; }
    public byte[]? TagsIv { get; set; }
    public string? Description { get; set; }
    public byte[]? DescriptionIv { get; set; }
}
