using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("note_attachments")]
public class EntityNoteAttachment
{
    public EntityNoteAttachment()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
    }

    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    // No [ForeignKey]/navigation property, same convention as EntityNote.ParentId: cascade
    // deletes are handled explicitly in application code (NoteService.Delete / UserService's
    // account-deletion path via IAttachmentService), not relied upon at the DB level.
    [Required]
    [Column("note_id")]
    public Guid NoteId { get; set; }

    [Required]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; }
    [Required]
    [Column("name_iv")]
    public byte[] NameIv { get; set; }
    [Required]
    [Column("content_iv")]
    public byte[] ContentIv { get; set; }
    [Required]
    [Column("size_bytes")]
    public long SizeBytes { get; set; }
    // Always forward-slash separated (e.g. "Data/Attachments/<guid>"), regardless of OS, so moving
    // the project between Windows/Linux deployments doesn't break stored paths.
    [Required]
    [Column("relative_path")]
    public string RelativePath { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
