using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Argyon.Backend.App.Shared.Entities;

[Table("user_permissions")]
public class EntityUserPermissions
{
    public EntityUserPermissions()
    {
        this.Id = Guid.NewGuid();
    }

    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    // Convention: null = inherits the role's permission (see EntitySystemSettings), true = allow, false = deny.
    [Column("can_manage_notes_override")]
    public bool? CanManageNotesOverride { get; set; }

    [Column("can_use_two_factor_override")]
    public bool? CanUseTwoFactorOverride { get; set; }

    #region FK
    [Required]
    [ForeignKey("User")]
    [Column("user_id")]
    public Guid UserId { get; set; }
    public virtual EntityUser User { get; set; }
    #endregion
}
