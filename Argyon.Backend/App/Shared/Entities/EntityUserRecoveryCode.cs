using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("user_recovery_codes")]
public class EntityUserRecoveryCode
{
    public EntityUserRecoveryCode()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
    }

    [Key]
    [Column("id")]
    public Guid Id { get; set; }
    [Required]
    [Column("code_hash")]
    public string CodeHash { get; set; }
    [Column("used_at")]
    public DateTime? UsedAt { get; set; }
    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    #region FK
    [Required]
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion
}
