using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("system_settings")]
public class EntitySystemSettings
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("registration_enabled")]
    public bool RegistrationEnabled { get; set; } = true;

    [Column("max_notes_administrator")]
    public long? MaxNotesAdministrator { get; set; }

    [Column("max_folders_administrator")]
    public long? MaxFoldersAdministrator { get; set; }

    [Column("max_notes_user")]
    public long? MaxNotesUser { get; set; }

    [Column("max_folders_user")]
    public long? MaxFoldersUser { get; set; }

    [Required]
    [Column("can_manage_notes_administrator")]
    public bool CanManageNotesAdministrator { get; set; } = true;

    [Required]
    [Column("can_use_two_factor_administrator")]
    public bool CanUseTwoFactorAdministrator { get; set; } = true;

    [Required]
    [Column("can_manage_notes_user")]
    public bool CanManageNotesUser { get; set; } = true;

    [Required]
    [Column("can_use_two_factor_user")]
    public bool CanUseTwoFactorUser { get; set; } = true;

    [Column("max_note_name_chars_administrator")]
    public long? MaxNoteNameCharsAdministrator { get; set; }

    [Column("max_note_name_chars_user")]
    public long? MaxNoteNameCharsUser { get; set; }

    [Column("max_note_description_chars_administrator")]
    public long? MaxNoteDescriptionCharsAdministrator { get; set; }

    [Column("max_note_description_chars_user")]
    public long? MaxNoteDescriptionCharsUser { get; set; }

    [Column("max_note_tags_chars_administrator")]
    public long? MaxNoteTagsCharsAdministrator { get; set; }

    [Column("max_note_tags_chars_user")]
    public long? MaxNoteTagsCharsUser { get; set; }

    [Column("max_note_data_kb_administrator")]
    public long? MaxNoteDataKbAdministrator { get; set; }

    [Column("max_note_data_kb_user")]
    public long? MaxNoteDataKbUser { get; set; }

    [Column("max_attachment_file_size_kb_administrator")]
    public long? MaxAttachmentFileSizeKbAdministrator { get; set; }

    [Column("max_attachment_file_size_kb_user")]
    public long? MaxAttachmentFileSizeKbUser { get; set; }

    // Precomputed by ContentLimitService.ComputeApproxMaxCiphertextBytes at the moment the owner
    // sets the *Chars limit above, so NoteService/FolderService never have to redo that math on
    // every create/update -- they just compare the ciphertext length against this stored value.
    [Column("max_note_name_approx_bytes_administrator")]
    public long? MaxNoteNameApproxBytesAdministrator { get; set; }

    [Column("max_note_name_approx_bytes_user")]
    public long? MaxNoteNameApproxBytesUser { get; set; }

    [Column("max_note_description_approx_bytes_administrator")]
    public long? MaxNoteDescriptionApproxBytesAdministrator { get; set; }

    [Column("max_note_description_approx_bytes_user")]
    public long? MaxNoteDescriptionApproxBytesUser { get; set; }

    [Column("max_note_tags_approx_bytes_administrator")]
    public long? MaxNoteTagsApproxBytesAdministrator { get; set; }

    [Column("max_note_tags_approx_bytes_user")]
    public long? MaxNoteTagsApproxBytesUser { get; set; }
}
