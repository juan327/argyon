using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("notes")]
public class EntityNote
{
    public EntityNote()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
        this.UpdatedAt = DateTime.UtcNow;
    }
    
    [Key]
    [Column("id")]
    public Guid Id { get; set; }
    [Required]
    [Column("is_folder")]
    public bool IsFolder { get; set; }
    [Required]
    [Column("is_favorite")]
    public bool IsFavorite { get; set; }
    [Required]
    [Column("has_attachments")]
    public bool HasAttachments { get; set; }
    [Required]
    [Column("name")]
    public string Name { get; set; }
    [Required]
    [Column("name_iv")]
    public byte[] NameIv { get; set; }
    [Column("data")]
    public string? Data { get; set; }
    [Column("data_iv")]
    public byte[]? DataIv { get; set; }

    [Column("description")]
    public string? Description { get; set; }
    [Column("description_iv")]
    public byte[]? DescriptionIv { get; set; }
    [Column("tags")]
    public string? Tags { get; set; } // List of tags separated by comma, example: "tag1,tag2,tag3"
    [Column("tags_iv")]
    public byte[]? TagsIv { get; set; }
    [Column("parent_id")]
    public Guid? ParentId { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
    [Required]
    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    #region FK
    
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion
}