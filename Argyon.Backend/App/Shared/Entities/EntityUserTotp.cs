using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("user_totps")]
public class EntityUserTotp
{
    public EntityUserTotp()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
        this.UpdatedAt = DateTime.UtcNow;
    }

    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("encrypted_secret")]
    public byte[] EncryptedSecret { get; set; }

    [Required]
    [Column("is_enabled")]
    public bool IsEnabled { get; set; }

    [Required]
    [Column("failed_attempts")]
    public int FailedAttempts { get; set; }

    [Column("locked_until")]
    public DateTime? LockedUntil { get; set; }

    [Column("last_used_time_step")]
    public long? LastUsedTimeStep { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("enabled_at")]
    public DateTime? EnabledAt { get; set; }
    
    [Required]
    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    #region FK
    [Required]
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion
}
