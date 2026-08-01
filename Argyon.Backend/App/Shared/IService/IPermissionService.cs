using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.IServices;

public enum PermissionCode
{
    ManageNotes = 1,
    TwoFactor = 2,
}

public record EffectivePermissions(bool CanManageNotes, bool CanUseTwoFactor);

public interface IPermissionService
{
    Task<bool> HasPermission(EntityUser caller, PermissionCode permission);
    Task<EffectivePermissions> GetEffectivePermissions(EntityUser caller);
}
