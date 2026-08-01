using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using ApiSqliteDemo.Data;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Services;

namespace Argyon.Backend.App.Shared.Filters;

// Gates an action/controller behind "the user proved knowledge of the master password within the
// last VaultFreshness:RequireReverifyMinutes minutes" (default 60), independently of whether the
// access/refresh tokens are still valid. Apply to endpoints that touch encrypted vault content or
// the Vault Key wrapping (notes/folders, change password, TOTP secrets) - see CLAUDE.md.
public class RequireFreshVaultAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var configuration = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var db = context.HttpContext.RequestServices.GetRequiredService<DataContext>();
        var localizer = context.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<SharedResource>>();

        var requireReverifyMinutes = configuration.GetSection("VaultFreshness").GetValue<double?>("RequireReverifyMinutes") ?? 60;

        var isFresh = false;
        if (context.HttpContext.Request.Cookies.TryGetValue("refresh_token", out string? refreshToken) &&
            string.IsNullOrEmpty(refreshToken) == false)
        {
            var tokenHash = GenericService.HashToken(refreshToken);
            var vaultUnlockedAt = await db.RefreshTokens.AsNoTracking()
                .Where(rt => rt.TokenHash == tokenHash && rt.IsRevoked == false)
                .Select(rt => rt.VaultUnlockedAt)
                .FirstOrDefaultAsync();

            isFresh = vaultUnlockedAt.HasValue &&
                (DateTime.UtcNow - vaultUnlockedAt.Value) <= TimeSpan.FromMinutes(requireReverifyMinutes);
        }

        if (isFresh == false)
        {
            context.Result = new ObjectResult(new DTOGeneric.DTOResponseApi
            {
                Message = localizer["VaultReauthRequired"],
                Code = "vault_reauth_required",
            })
            {
                StatusCode = StatusCodes.Status401Unauthorized,
            };
            return;
        }

        await next();
    }
}
