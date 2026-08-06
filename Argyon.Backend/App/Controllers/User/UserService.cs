using System.Data.Common;
using System.Net;
using System.Text.Json;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.Scopeds;
using Argyon.Backend.App.Shared.Services;
using Argyon.Backend.App.Shared.IServices;
using Argyon.Backend.App.Controllers.Attachment;

namespace Argyon.Backend.App.Controllers.User;

public class UserService: IUserService
{

    private readonly DataContext db;
    private readonly PasswordService passwordService = new PasswordService();
    private readonly IConfiguration configuration;
    private readonly IPermissionService permissionService;
    private readonly IContentLimitService contentLimitService;
    private readonly ISystemSettingsCache systemSettingsCache;
    private readonly IAttachmentService attachmentService;
    private readonly IStringLocalizer<SharedResource> localizer;

    public UserService(DataContext _db, IConfiguration _configuration, IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> _jsonOptions, IPermissionService _permissionService, IContentLimitService _contentLimitService, ISystemSettingsCache _systemSettingsCache, IAttachmentService _attachmentService, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.configuration = _configuration;
        this.permissionService = _permissionService;
        this.contentLimitService = _contentLimitService;
        this.systemSettingsCache = _systemSettingsCache;
        this.attachmentService = _attachmentService;
        this.localizer = _localizer;
    }

    // Validations shared by Register (self-registration) and Create (creation by Owner/Administrator):
    // both flows create a new account with the same encryption material (salt + KDF + wrapped Vault Key).
    // Password equality/length are validated client-side only: the server never sees the raw password,
    // just the derived AuthHash, which carries no meaningful length/content signal to validate.
    private string? ValidateNewUserFields(string username, string authHash,
        byte[] salt, string kdfAlgorithm, byte[] encryptedVaultKeyIv, string encryptedVaultKey)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(authHash))
        {
            return this.localizer["UsernameAndPasswordRequired"];
        }
        if (username.Length < 3)
        {
            return this.localizer["UsernameMinLength"];
        }
        if (username.Length > 20)
        {
            return this.localizer["UsernameMaxLength"];
        }
        if (salt == null || salt.Length == 0 ||
            encryptedVaultKeyIv == null || encryptedVaultKeyIv.Length == 0 ||
            string.IsNullOrWhiteSpace(encryptedVaultKey) ||
            string.IsNullOrWhiteSpace(kdfAlgorithm))
        {
            return this.localizer["InvalidEncryptionData"];
        }
        return null;
    }

    // The user's session tokens are evicted from the MemoryCache (same as Logout does) and the
    // UserSessions rows are deleted, so access is lost immediately instead of waiting
    // for the token to expire on its own. Used by Delete and by SetBlocked (when blocking).
    private async Task RevokeUserSessions(Guid userId)
    {
        var tokens = await this.db.UserSessions.AsNoTracking()
            .Where(us => us.UserId == userId)
            .Select(us => us.Token)
            .ToListAsync();
        foreach (var token in tokens)
        {
            JwtEventsHandler.memoryCache.Remove(token);
        }
        await this.db.UserSessions.Where(us => us.UserId == userId).ExecuteDeleteAsync();
    }

    public async Task<DTOGeneric.DTOResponseApi> Register(VMUser.VMRegister request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var anyUser = this.db.Users.Any();
            if (anyUser == true)
            {
                var settings = await this.systemSettingsCache.Get(this.db);
                if (settings.RegistrationEnabled == false)
                {
                    response.StatusCode = HttpStatusCode.Forbidden;
                    response.Message = this.localizer["RegistrationDisabled"];
                    return response;
                }
            }

            var validationError = this.ValidateNewUserFields(request.Username, request.AuthHash,
                request.Salt, request.KdfAlgorithm, request.EncryptedVaultKeyIv, request.EncryptedVaultKey);
            if (validationError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = validationError;
                return response;
            }

            var newUser = new EntityUser
            {
                Username = request.Username.ToLower().Trim(),
                AuthHash = this.passwordService.HashPassword(request.AuthHash), // Hash the client-derived AuthHash with Argon2id
                Salt = request.Salt, // Salt used by the client to derive the KEK
                KdfAlgorithm = request.KdfAlgorithm,
                KdfMemory = request.KdfMemory,
                KdfIterations = request.KdfIterations,
                KdfParallelism = request.KdfParallelism,
                EncryptedVaultKeyIv = request.EncryptedVaultKeyIv,
                EncryptedVaultKey = request.EncryptedVaultKey,
            };

            newUser.RoleCode = anyUser == false ? EntityUser_RoleCode.Owner : EntityUser_RoleCode.User;

            this.db.Users.Add(newUser);
            GenericService.CreateUserSession(this.db, this.configuration, httpContext, newUser);
            GenericService.CreateRefreshToken(this.db, this.configuration, httpContext, newUser, DateTime.UtcNow);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["RegisterSuccess"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    // Public, unauthenticated: lets the client derive the KEK/AuthHash locally before it can send
    // anything to Login.
    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOPreloginInfo>> Prelogin(VMUser.VMPrelogin request)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTOPreloginInfo>();
        try
        {
            var normalizedUsername = (request.Username ?? string.Empty).ToLower().Trim();
            var findUser = await this.db.Users.AsNoTracking()
                .Where(u => u.Username == normalizedUsername)
                .Select(u => new { u.Salt, u.KdfAlgorithm, u.KdfMemory, u.KdfIterations, u.KdfParallelism })
                .FirstOrDefaultAsync();

            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidCredentials"];
                return response;
            }

            response.Data = new DTOUser.DTOPreloginInfo
            {
                Salt = findUser.Salt,
                KdfAlgorithm = findUser.KdfAlgorithm,
                KdfMemory = findUser.KdfMemory,
                KdfIterations = findUser.KdfIterations,
                KdfParallelism = findUser.KdfParallelism,
            };
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOLoginResponse>> Login(VMUser.VMLogin request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTOLoginResponse>();
        try
        {
            var findUser = this.db.Users.FirstOrDefault(u => u.Username == request.Username.ToLower().Trim());
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidCredentials"];
                return response;
            }

            var isPasswordValid = this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash);
            if (isPasswordValid == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidCredentials"];
                return response;
            }

            // A blocked account can still log in: BlockedUserRestrictionMiddleware restricts
            // that session to only being able to export its data, the login itself is not rejected.
            var totpEnabled = this.db.UserTotps.AsNoTracking().Any(t => t.UserId == findUser.Id && t.IsEnabled);
            if (totpEnabled)
            {
                // No EntityUserSession is created nor is the access_token cookie set yet: only
                // Totp/VerifyLogin, after validating the code, issues the real session (GenericService.IssueSession).
                var pendingToken = GenericService.GeneratePendingUserToken(this.configuration, findUser.Username, DateTime.UtcNow.AddMinutes(5));
                response.Data = new DTOUser.DTOLoginResponse
                {
                    RequiresTwoFactor = true,
                    PendingToken = pendingToken,
                };
                response.StatusCode = HttpStatusCode.OK;
                response.Message = this.localizer["TwoFactorCodeRequired"];
                return response;
            }

            GenericService.CreateUserSession(this.db, this.configuration, httpContext, findUser);
            GenericService.CreateRefreshToken(this.db, this.configuration, httpContext, findUser, DateTime.UtcNow);
            await this.db.SaveChangesAsync();

            response.Data = new DTOUser.DTOLoginResponse
            {
                RequiresTwoFactor = false,
                VaultKeyInfo = new DTOUser.DTOVaultKeyInfo
                {
                    Salt = findUser.Salt,
                    KdfAlgorithm = findUser.KdfAlgorithm,
                    KdfMemory = findUser.KdfMemory,
                    KdfIterations = findUser.KdfIterations,
                    KdfParallelism = findUser.KdfParallelism,
                    EncryptedVaultKeyIv = findUser.EncryptedVaultKeyIv,
                    EncryptedVaultKey = findUser.EncryptedVaultKey,
                },
            };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["LoginSuccess"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Logout(HttpRequest httpRequest, HttpResponse httpResponse)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            if (httpRequest.Cookies.TryGetValue("access_token", out string? token))
            {
                var userSession = this.db.UserSessions.FirstOrDefault(us => us.Token == token);
                if (userSession != null)
                {
                    JwtEventsHandler.memoryCache.Remove(userSession.Token);
                    this.db.UserSessions.Remove(userSession);
                    this.db.SaveChanges();
                }
                httpResponse.Cookies.Delete("access_token");
            }

            if (httpRequest.Cookies.TryGetValue("refresh_token", out string? refreshToken))
            {
                var refreshTokenHash = GenericService.HashToken(refreshToken);
                var refreshTokenEntity = this.db.RefreshTokens.FirstOrDefault(rt => rt.TokenHash == refreshTokenHash);
                if (refreshTokenEntity != null)
                {
                    this.db.RefreshTokens.Remove(refreshTokenEntity);
                    this.db.SaveChanges();
                }
                httpResponse.Cookies.Delete("refresh_token");
            }
            response.Message = this.localizer["LogoutSuccess"];
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.Message = this.localizer["UnexpectedError"];
            response.StatusCode = HttpStatusCode.InternalServerError;
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTORefreshResponse>> Refresh(HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTORefreshResponse>();
        try
        {
            httpContext.Request.Cookies.TryGetValue("refresh_token", out string? refreshToken);
            var (result, newToken) = await GenericService.RotateRefreshToken(this.db, this.configuration, httpContext, refreshToken);

            if (result == RefreshRotationResult.ReuseDetected)
            {
                await this.db.SaveChangesAsync();
                httpContext.Response.Cookies.Delete("access_token");
                httpContext.Response.Cookies.Delete("refresh_token");
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["RefreshTokenReuseDetected"];
                response.Code = "refresh_reuse_detected";
                return response;
            }

            if (result == RefreshRotationResult.Invalid || newToken == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["InvalidRefreshToken"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == newToken.UserId);
            if (findUser == null)
            {
                await this.db.SaveChangesAsync();
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            GenericService.CreateUserSession(this.db, this.configuration, httpContext, findUser);
            await this.db.SaveChangesAsync();

            var requireReverifyMinutes = this.configuration.GetSection("VaultFreshness").GetValue<double?>("RequireReverifyMinutes") ?? 60;
            var vaultFresh = newToken.VaultUnlockedAt.HasValue &&
                (DateTime.UtcNow - newToken.VaultUnlockedAt.Value) <= TimeSpan.FromMinutes(requireReverifyMinutes);

            response.Data = new DTOUser.DTORefreshResponse { VaultFresh = vaultFresh };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["SessionRefreshed"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    // Called periodically by the frontend while the vault is unlocked and the tab is visible, so
    // an actively-used session doesn't hit the vaultFreshnessMinutes deadline. Relies on
    // [RequireFreshVault] on the controller action to only ever extend an already-fresh session,
    // never resurrect one that already expired without re-proving the master password.
    public async Task<DTOGeneric.DTOResponseApi> TouchVault(HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            if (httpContext.Request.Cookies.TryGetValue("refresh_token", out string? refreshToken))
            {
                var refreshTokenHash = GenericService.HashToken(refreshToken);
                var refreshTokenEntity = await this.db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == refreshTokenHash && rt.IsRevoked == false);
                if (refreshTokenEntity != null)
                {
                    refreshTokenEntity.VaultUnlockedAt = DateTime.UtcNow;
                    await this.db.SaveChangesAsync();
                }
            }

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["VaultTouched"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>> ValidatePassword(VMUser.VMValidatePassword request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findUser = this.db.Users.AsNoTracking().Where(u => u.Id == userId.Value)
                .Select(u => new { u.AuthHash, u.Salt, u.KdfAlgorithm, u.KdfMemory, u.KdfIterations, u.KdfParallelism, u.EncryptedVaultKeyIv, u.EncryptedVaultKey })
                .FirstOrDefault();
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            var isPasswordValid = this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash);
            if (isPasswordValid == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["IncorrectPassword"];
                return response;
            }

            // This endpoint doubles as the "vault freshness" re-verification: a successful check
            // here always means the caller just proved knowledge of the master password, whether
            // it's the normal unlock-after-reload flow or the periodic forced re-unlock.
            if (httpContext.Request.Cookies.TryGetValue("refresh_token", out string? refreshToken))
            {
                var refreshTokenHash = GenericService.HashToken(refreshToken);
                var refreshTokenEntity = await this.db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == refreshTokenHash && rt.IsRevoked == false);
                if (refreshTokenEntity != null)
                {
                    refreshTokenEntity.VaultUnlockedAt = DateTime.UtcNow;
                    await this.db.SaveChangesAsync();
                }
            }

            response.Data = new DTOUser.DTOVaultKeyInfo
            {
                Salt = findUser.Salt,
                KdfAlgorithm = findUser.KdfAlgorithm,
                KdfMemory = findUser.KdfMemory,
                KdfIterations = findUser.KdfIterations,
                KdfParallelism = findUser.KdfParallelism,
                EncryptedVaultKeyIv = findUser.EncryptedVaultKeyIv,
                EncryptedVaultKey = findUser.EncryptedVaultKey,
            };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["PasswordValid"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> ChangePassword(VMUser.VMChangePassword request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            if (string.IsNullOrWhiteSpace(request.NewAuthHash))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["NewPasswordRequired"];
                return response;
            }

            if (request.Salt == null || request.Salt.Length == 0 ||
                request.EncryptedVaultKeyIv == null || request.EncryptedVaultKeyIv.Length == 0 ||
                string.IsNullOrWhiteSpace(request.EncryptedVaultKey) ||
                string.IsNullOrWhiteSpace(request.KdfAlgorithm))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidEncryptionData"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            var isPasswordValid = this.passwordService.VerifyPassword(request.CurrentAuthHash, findUser.AuthHash);
            if (isPasswordValid == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CurrentPasswordIncorrect"];
                return response;
            }

            // Only the Vault Key is re-wrapped with a new KEK; the notes are not touched.
            findUser.AuthHash = this.passwordService.HashPassword(request.NewAuthHash);
            findUser.Salt = request.Salt;
            findUser.KdfAlgorithm = request.KdfAlgorithm;
            findUser.KdfMemory = request.KdfMemory;
            findUser.KdfIterations = request.KdfIterations;
            findUser.KdfParallelism = request.KdfParallelism;
            findUser.EncryptedVaultKeyIv = request.EncryptedVaultKeyIv;
            findUser.EncryptedVaultKey = request.EncryptedVaultKey;
            findUser.UpdatedAt = DateTime.UtcNow;

            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["PasswordUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOMe>> Me(HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTOMe>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findUser = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            var effective = await this.permissionService.GetEffectivePermissions(findUser);
            var contentLimits = await this.contentLimitService.GetEffectiveLimits(findUser);
            response.Data = new DTOUser.DTOMe
            {
                Id = findUser.Id,
                Username = findUser.Username,
                RoleCode = findUser.RoleCode,
                IsBlocked = findUser.IsBlocked,
                CanManageNotes = effective.CanManageNotes,
                CanUseTwoFactor = effective.CanUseTwoFactor,
                MaxNoteNameChars = contentLimits.MaxNameChars,
                MaxNoteDescriptionChars = contentLimits.MaxDescriptionChars,
                MaxNoteTagsChars = contentLimits.MaxTagsChars,
                MaxNoteDataKb = contentLimits.MaxDataKb,
                MaxAttachmentFileSizeKb = contentLimits.MaxAttachmentFileSizeKb,
                AccessTokenExpiryMinutes = this.configuration.GetSection("Jwt").GetValue<double?>("AccessTokenExpiryMinutes") ?? 15,
                VaultFreshnessMinutes = this.configuration.GetSection("VaultFreshness").GetValue<double?>("RequireReverifyMinutes") ?? 60,
            };
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiPagedListData<DTOUser.DTOUserList>> List(VMUser.VMList request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiPagedListData<DTOUser.DTOUserList>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            IQueryable<EntityUser> visibleUsers;
            switch (caller.RoleCode)
            {
                case EntityUser_RoleCode.Owner:
                    visibleUsers = this.db.Users.AsNoTracking()
                        .Where(u => u.RoleCode == EntityUser_RoleCode.Administrator || u.RoleCode == EntityUser_RoleCode.User);
                    break;
                case EntityUser_RoleCode.Administrator:
                    visibleUsers = this.db.Users.AsNoTracking().Where(u => u.RoleCode == EntityUser_RoleCode.User);
                    break;
                default:
                    response.StatusCode = HttpStatusCode.Forbidden;
                    response.Message = this.localizer["NoAccessModulePermission"];
                    return response;
            }

            if (string.IsNullOrWhiteSpace(request.Search) == false)
            {
                var search = request.Search.Trim().ToLower();
                visibleUsers = visibleUsers.Where(u => u.Username.Contains(search));
            }

            var skip = Math.Max(request.Skip, 0);
            var take = Math.Clamp(request.Take, 1, 100);

            var totalCount = await visibleUsers.CountAsync();
            var users = await visibleUsers.OrderBy(u => u.Username).Skip(skip).Take(take).ToListAsync();
            var userIds = users.Select(u => u.Id).ToList();
            var permissionsByUserId = await this.db.UserPermissions.AsNoTracking()
                .Where(p => userIds.Contains(p.UserId))
                .ToDictionaryAsync(p => p.UserId);

            response.Data = users.Select(u =>
            {
                permissionsByUserId.TryGetValue(u.Id, out var perms);
                return new DTOUser.DTOUserList
                {
                    Id = u.Id,
                    Username = u.Username,
                    RoleCode = u.RoleCode,
                    CreatedAt = u.CreatedAt,
                    IsBlocked = u.IsBlocked,
                    MaxNotesOverride = u.MaxNotesOverride,
                    MaxFoldersOverride = u.MaxFoldersOverride,
                    CanManageNotesOverride = perms?.CanManageNotesOverride,
                    CanUseTwoFactorOverride = perms?.CanUseTwoFactorOverride,
                    MaxNoteNameCharsOverride = u.MaxNoteNameCharsOverride,
                    MaxNoteDescriptionCharsOverride = u.MaxNoteDescriptionCharsOverride,
                    MaxNoteTagsCharsOverride = u.MaxNoteTagsCharsOverride,
                    MaxNoteDataKbOverride = u.MaxNoteDataKbOverride,
                    MaxAttachmentFileSizeKbOverride = u.MaxAttachmentFileSizeKbOverride,
                };
            }).ToList();
            response.TotalCount = totalCount;
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> ChangeRole(VMUser.VMChangeRole request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifyRolePermission"];
                return response;
            }

            if (Enum.IsDefined(request.RoleCode) == false || request.RoleCode == EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidRole"];
                return response;
            }
            var newRoleCode = request.RoleCode;

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (targetUser.RoleCode == EntityUser_RoleCode.Owner || targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotModifyThisUserRole"];
                return response;
            }

            targetUser.RoleCode = newRoleCode;
            targetUser.UpdatedAt = DateTime.UtcNow;
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["RoleUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Delete(VMUser.VMDelete request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoDeleteUserPermission"];
                return response;
            }

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (targetUser.RoleCode == EntityUser_RoleCode.Owner || targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotDeleteThisUser"];
                return response;
            }

            // The deleted user's active sessions are invalidated: otherwise they would keep authenticating
            // until their natural expiration even though the UserSessions row no longer exists.
            await this.RevokeUserSessions(targetUser.Id);

            // Related rows are explicitly deleted instead of relying on an implicit EF/SQLite
            // cascade delete, since the database is created with EnsureCreated (no migrations).
            await this.attachmentService.DeleteForUser(targetUser.Id);
            await this.db.Notes.Where(n => n.UserId == targetUser.Id).ExecuteDeleteAsync();
            await this.db.UserTotps.Where(t => t.UserId == targetUser.Id).ExecuteDeleteAsync();
            await this.db.UserRecoveryCodes.Where(rc => rc.UserId == targetUser.Id).ExecuteDeleteAsync();
            await this.db.UserPermissions.Where(p => p.UserId == targetUser.Id).ExecuteDeleteAsync();

            this.db.Users.Remove(targetUser);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["UserDeleted"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Create(VMUser.VMCreate request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (Enum.IsDefined(request.RoleCode) == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidRole"];
                return response;
            }
            var newRoleCode = request.RoleCode;

            // The Owner can create Administrators and Users; the Administrator only Users;
            // no one can create another Owner from this endpoint.
            var canCreateRole = caller.RoleCode switch
            {
                EntityUser_RoleCode.Owner => newRoleCode == EntityUser_RoleCode.Administrator || newRoleCode == EntityUser_RoleCode.User,
                EntityUser_RoleCode.Administrator => newRoleCode == EntityUser_RoleCode.User,
                _ => false,
            };
            if (canCreateRole == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoCreateUserWithRolePermission"];
                return response;
            }

            var validationError = this.ValidateNewUserFields(request.Username, request.AuthHash,
                request.Salt, request.KdfAlgorithm, request.EncryptedVaultKeyIv, request.EncryptedVaultKey);
            if (validationError != null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = validationError;
                return response;
            }

            var normalizedUsername = request.Username.ToLower().Trim();
            var usernameTaken = await this.db.Users.AsNoTracking().AnyAsync(u => u.Username == normalizedUsername);
            if (usernameTaken == true)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["UsernameAlreadyTaken"];
                return response;
            }

            var newUser = new EntityUser
            {
                Username = normalizedUsername,
                AuthHash = this.passwordService.HashPassword(request.AuthHash),
                Salt = request.Salt,
                KdfAlgorithm = request.KdfAlgorithm,
                KdfMemory = request.KdfMemory,
                KdfIterations = request.KdfIterations,
                KdfParallelism = request.KdfParallelism,
                EncryptedVaultKeyIv = request.EncryptedVaultKeyIv,
                EncryptedVaultKey = request.EncryptedVaultKey,
                RoleCode = newRoleCode,
            };

            // No session is created: this is an administrative creation, not a login for the new user.
            this.db.Users.Add(newUser);
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["UserCreated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetBlocked(VMUser.VMSetBlocked request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotBlockYourself"];
                return response;
            }

            // Same scope as Get: the Owner sees/manages Administrators and Users;
            // the Administrator only Users. No one can block an Owner.
            var canManageTarget = caller.RoleCode switch
            {
                EntityUser_RoleCode.Owner => targetUser.RoleCode == EntityUser_RoleCode.Administrator || targetUser.RoleCode == EntityUser_RoleCode.User,
                EntityUser_RoleCode.Administrator => targetUser.RoleCode == EntityUser_RoleCode.User,
                _ => false,
            };
            if (canManageTarget == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoBlockUserPermission"];
                return response;
            }

            targetUser.IsBlocked = request.IsBlocked;
            targetUser.UpdatedAt = DateTime.UtcNow;

            if (request.IsBlocked == true)
            {
                await this.RevokeUserSessions(targetUser.Id);
            }

            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = request.IsBlocked ? this.localizer["UserBlocked"] : this.localizer["UserUnblocked"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetLimits(VMUser.VMSetLimits request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifyUserLimitsPermission"];
                return response;
            }

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            // The Owner is never subject to a limit, so it also makes no sense to set an override for them.
            if (targetUser.RoleCode == EntityUser_RoleCode.Owner || targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotModifyThisUserLimit"];
                return response;
            }

            targetUser.MaxNotesOverride = request.MaxNotesOverride;
            targetUser.MaxFoldersOverride = request.MaxFoldersOverride;
            targetUser.UpdatedAt = DateTime.UtcNow;

            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["LimitsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetPermissions(VMUser.VMSetPermissions request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifyUserPermissionsPermission"];
                return response;
            }

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            // The Owner is never subject to permissions, so it also makes no sense to set an override for them.
            if (targetUser.RoleCode == EntityUser_RoleCode.Owner || targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotModifyThisUserPermissions"];
                return response;
            }

            var permissions = await this.db.UserPermissions.FirstOrDefaultAsync(p => p.UserId == targetUser.Id);
            if (permissions == null)
            {
                permissions = new EntityUserPermissions { UserId = targetUser.Id };
                this.db.UserPermissions.Add(permissions);
            }
            permissions.CanManageNotesOverride = request.CanManageNotesOverride;
            permissions.CanUseTwoFactorOverride = request.CanUseTwoFactorOverride;

            targetUser.UpdatedAt = DateTime.UtcNow;
            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["PermissionsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> SetContentLimits(VMUser.VMSetContentLimits request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApi();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var caller = await this.db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (caller == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (caller.RoleCode != EntityUser_RoleCode.Owner)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["NoModifyUserLimitsPermission"];
                return response;
            }

            var targetUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
            if (targetUser == null)
            {
                response.StatusCode = HttpStatusCode.NotFound;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            // The Owner is never subject to a limit, so it also makes no sense to set an override for them.
            if (targetUser.RoleCode == EntityUser_RoleCode.Owner || targetUser.Id == caller.Id)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["CannotModifyThisUserLimit"];
                return response;
            }

            int?[] providedValues =
            [
                request.MaxNoteNameCharsOverride, request.MaxNoteDescriptionCharsOverride,
                request.MaxNoteTagsCharsOverride, request.MaxNoteDataKbOverride,
                request.MaxAttachmentFileSizeKbOverride,
            ];
            // Convention shared with MaxNotesOverride/MaxFoldersOverride: -1 = explicit unlimited.
            if (providedValues.Any(v => v.HasValue && v.Value != -1 && v.Value <= 0))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["ContentLimitMustBePositive"];
                return response;
            }

            targetUser.MaxNoteNameCharsOverride = request.MaxNoteNameCharsOverride;
            targetUser.MaxNoteDescriptionCharsOverride = request.MaxNoteDescriptionCharsOverride;
            targetUser.MaxNoteTagsCharsOverride = request.MaxNoteTagsCharsOverride;
            targetUser.MaxNoteDataKbOverride = request.MaxNoteDataKbOverride;
            targetUser.MaxAttachmentFileSizeKbOverride = request.MaxAttachmentFileSizeKbOverride;

            // Precomputed once here, following the same null/-1/value convention as the *CharsOverride
            // fields above, so NoteService/FolderService only ever compare against a stored value.
            targetUser.MaxNoteNameApproxBytesOverride = ToApproxBytesOverride(request.MaxNoteNameCharsOverride);
            targetUser.MaxNoteDescriptionApproxBytesOverride = ToApproxBytesOverride(request.MaxNoteDescriptionCharsOverride);
            targetUser.MaxNoteTagsApproxBytesOverride = ToApproxBytesOverride(request.MaxNoteTagsCharsOverride);

            targetUser.UpdatedAt = DateTime.UtcNow;

            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["ContentLimitsUpdated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    // Mirrors the null/-1/value convention of *CharsOverride onto the paired *ApproxBytesOverride
    // column: null (inherit) and -1 (explicit unlimited) pass through unchanged, a concrete char
    // count gets precomputed into its approximate max ciphertext length.
    private int? ToApproxBytesOverride(int? charsOverride)
    {
        if (charsOverride == null || charsOverride == -1)
        {
            return charsOverride;
        }
        return this.contentLimitService.ComputeApproxMaxCiphertextBytes(charsOverride.Value);
    }

}
