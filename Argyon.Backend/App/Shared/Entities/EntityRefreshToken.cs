using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("refresh_tokens")]
public class EntityRefreshToken
{
    public EntityRefreshToken()
    {
        this.Id = Guid.NewGuid();
        this.CreatedAt = DateTime.UtcNow;
    }

    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("token_hash")]
    public string TokenHash { get; set; }

    [Required]
    [Column("family_id")]
    public Guid FamilyId { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Required]
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Required]
    [Column("is_revoked")]
    public bool IsRevoked { get; set; } = false;

    [Column("replaced_by_token_id")]
    public Guid? ReplacedByTokenId { get; set; }

    // Timestamp of the last time the user proved knowledge of the master password
    // (login or User/ValidatePassword). Carried over on every rotation so re-verifying
    // the master password doesn't get lost when the access token silently refreshes.
    [Column("vault_unlocked_at")]
    public DateTime? VaultUnlockedAt { get; set; }

    #region  FK
    [Required]
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion
}
