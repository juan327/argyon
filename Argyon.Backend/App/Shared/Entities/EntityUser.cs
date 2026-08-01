using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("users")]
public class EntityUser
{
    public EntityUser()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
        this.UpdatedAt = DateTime.UtcNow;
    }
    
    [Key]
    [Column("id")]
    public Guid Id { get; set; }
    [Required]
    [StringLength(20)]
    [Column("username")]
    public string Username { get; set; }
    [Required]
    [Column("auth_hash")]
    public string AuthHash { get; set; }
    [Required]
    [Column("salt")]
    public byte[] Salt { get; set; }
    [Required]
    [Column("kdf_algorithm")]
    public string KdfAlgorithm { get; set; }
    [Required]
    [Column("kdf_memory")]
    public int KdfMemory { get; set; }
    [Required]
    [Column("kdf_iterations")]
    public int KdfIterations { get; set; }
    [Required]
    [Column("kdf_parallelism")]
    public int KdfParallelism { get; set; }
    [Required]
    [Column("encrypted_vault_key_iv")]
    public byte[] EncryptedVaultKeyIv { get; set; }
    [Required]
    [Column("encrypted_vault_key")]
    public string EncryptedVaultKey { get; set; }
    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
    [Required]
    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Required]
    [Column("role_code")]
    public EntityUser_RoleCode RoleCode { get; set; }

    [Required]
    [Column("is_blocked")]
    public bool IsBlocked { get; set; } = false;

    [Column("max_notes_override")]
    public long? MaxNotesOverride { get; set; }

    [Column("max_folders_override")]
    public long? MaxFoldersOverride { get; set; }

    [Column("max_note_name_chars_override")]
    public long? MaxNoteNameCharsOverride { get; set; }

    [Column("max_note_description_chars_override")]
    public long? MaxNoteDescriptionCharsOverride { get; set; }

    [Column("max_note_tags_chars_override")]
    public long? MaxNoteTagsCharsOverride { get; set; }

    [Column("max_note_data_kb_override")]
    public long? MaxNoteDataKbOverride { get; set; }

    [Column("max_attachment_file_size_kb_override")]
    public long? MaxAttachmentFileSizeKbOverride { get; set; }

    // Precomputed by ContentLimitService.ComputeApproxMaxCiphertextBytes at the moment the
    // *CharsOverride above is set, following the same null/-1/value convention, so
    // NoteService/FolderService never have to redo that math on every create/update.
    [Column("max_note_name_approx_bytes_override")]
    public long? MaxNoteNameApproxBytesOverride { get; set; }

    [Column("max_note_description_approx_bytes_override")]
    public long? MaxNoteDescriptionApproxBytesOverride { get; set; }

    [Column("max_note_tags_approx_bytes_override")]
    public long? MaxNoteTagsApproxBytesOverride { get; set; }
}


public enum EntityUser_RoleCode
{
    Owner = 1,
    Administrator = 2,
    User = 3,
}