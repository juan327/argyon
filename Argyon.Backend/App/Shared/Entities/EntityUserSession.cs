using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("user_sessions")]
public class EntityUserSession
{
    public EntityUserSession()
    {
        CreatedAt = DateTime.UtcNow;
    }

    [Key]
    [Column("token")]
    public string Token { get; set; }
    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
    [Required]
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    #region  FK
    [Required]
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion

}