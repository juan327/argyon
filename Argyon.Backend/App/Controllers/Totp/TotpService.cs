using System.Net;
using System.Security.Cryptography;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using OtpNet;
using Argyon.Backend.App.Controllers.User;
using Argyon.Backend.App.Shared.DTO;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.Extensions;
using Argyon.Backend.App.Shared.Services;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Controllers.Totp;

public class TotpService : ITotpService
{
    private readonly DataContext db;
    private readonly PasswordService passwordService = new PasswordService();
    private readonly IConfiguration configuration;
    private readonly IPermissionService permissionService;
    private readonly IStringLocalizer<SharedResource> localizer;

    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;
    private const int RecoveryCodeCount = 8;

    public TotpService(DataContext _db, IConfiguration _configuration, IPermissionService _permissionService, IStringLocalizer<SharedResource> _localizer)
    {
        this.db = _db;
        this.configuration = _configuration;
        this.permissionService = _permissionService;
        this.localizer = _localizer;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOSetup>> Setup(VMTotp.VMSetup request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOTotp.DTOSetup>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (await this.permissionService.HasPermission(findUser, PermissionCode.TwoFactor) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["TwoFactorDisabledByAdministrator"];
                return response;
            }

            var existing = await this.db.UserTotps.FirstOrDefaultAsync(t => t.UserId == userId.Value);
            if (existing != null)
            {
                // If two-factor is already active, we require the current password before replacing it:
                // otherwise, whoever steals just the session cookie (without knowing the password) could
                // disable the victim's 2FA by calling Setup with their own secret.
                if (existing.IsEnabled)
                {
                    if (string.IsNullOrWhiteSpace(request.AuthHash) || this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash) == false)
                    {
                        response.StatusCode = HttpStatusCode.BadRequest;
                        response.Message = this.localizer["CurrentPasswordRequiredForTwoFactorReset"];
                        return response;
                    }
                }

                this.db.UserTotps.Remove(existing);
            }

            var secretBytes = KeyGeneration.GenerateRandomKey(20);
            var key = TotpCryptoService.DeriveKey(this.configuration);
            var encryptedSecret = TotpCryptoService.Encrypt(secretBytes, key);

            this.db.UserTotps.Add(new EntityUserTotp
            {
                UserId = userId.Value,
                EncryptedSecret = encryptedSecret,
                IsEnabled = false,
            });
            await this.db.SaveChangesAsync();

            var base32Secret = Base32Encoding.ToString(secretBytes);
            var uri = $"otpauth://totp/Argyon:{Uri.EscapeDataString(findUser.Username)}?secret={base32Secret}&issuer=Argyon&digits=6&period=30";

            response.Data = new DTOTotp.DTOSetup { Secret = base32Secret, Uri = uri };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["ScanQrCodeInstructions"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>> Enable(VMTotp.VMEnable request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (await this.permissionService.HasPermission(findUser, PermissionCode.TwoFactor) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["TwoFactorDisabledByAdministrator"];
                return response;
            }

            if (string.IsNullOrWhiteSpace(request.AuthHash) || this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash) == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["IncorrectPassword"];
                return response;
            }

            var findUserTotp = await this.db.UserTotps.FirstOrDefaultAsync(t => t.UserId == userId.Value);
            if (findUserTotp == null || findUserTotp.IsEnabled)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["NoPendingTwoFactorSetup"];
                return response;
            }

            var key = TotpCryptoService.DeriveKey(this.configuration);
            if (this.ValidateCode(findUserTotp, request.Code, key, out var matchedStep) == false)
            {
                await this.db.SaveChangesAsync();
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidTotpCode"];
                return response;
            }

            findUserTotp.IsEnabled = true;
            findUserTotp.EnabledAt = DateTime.UtcNow;
            findUserTotp.LastUsedTimeStep = matchedStep;
            findUserTotp.UpdatedAt = DateTime.UtcNow;

            var oldCodes = await this.db.UserRecoveryCodes.Where(rc => rc.UserId == userId.Value).ToListAsync();
            this.db.UserRecoveryCodes.RemoveRange(oldCodes);

            var recoveryCodes = this.GenerateRecoveryCodes(userId.Value);
            await this.db.SaveChangesAsync();

            response.Data = new DTOTotp.DTOEnable { RecoveryCodes = recoveryCodes };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["TwoFactorEnabled"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApi> Disable(VMTotp.VMDisable request, HttpContext httpContext)
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

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (await this.permissionService.HasPermission(findUser, PermissionCode.TwoFactor) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["TwoFactorDisabledByAdministrator"];
                return response;
            }

            if (string.IsNullOrWhiteSpace(request.AuthHash) || this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash) == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["IncorrectPassword"];
                return response;
            }

            var findUserTotp = await this.db.UserTotps.FirstOrDefaultAsync(t => t.UserId == userId.Value && t.IsEnabled);
            if (findUserTotp == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["TwoFactorNotActive"];
                return response;
            }

            var key = TotpCryptoService.DeriveKey(this.configuration);
            var codeValid = this.ValidateCode(findUserTotp, request.Code, key, out _);
            if (codeValid == false && await this.TryConsumeRecoveryCode(userId.Value, request.Code) == false)
            {
                await this.db.SaveChangesAsync();
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidTotpCode"];
                return response;
            }

            this.db.UserTotps.Remove(findUserTotp);

            var codes = await this.db.UserRecoveryCodes.Where(rc => rc.UserId == userId.Value).ToListAsync();
            this.db.UserRecoveryCodes.RemoveRange(codes);

            await this.db.SaveChangesAsync();

            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["TwoFactorDisabled"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>> RegenerateRecoveryCodes(VMTotp.VMRegenerateRecoveryCodes request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>();
        try
        {
            var userId = httpContext.GetUserId();
            if (userId == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotAuthenticated"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            if (await this.permissionService.HasPermission(findUser, PermissionCode.TwoFactor) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["TwoFactorDisabledByAdministrator"];
                return response;
            }

            if (string.IsNullOrWhiteSpace(request.AuthHash) || this.passwordService.VerifyPassword(request.AuthHash, findUser.AuthHash) == false)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["IncorrectPassword"];
                return response;
            }

            var record = await this.db.UserTotps.FirstOrDefaultAsync(t => t.UserId == userId.Value && t.IsEnabled);
            if (record == null)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["TwoFactorNotActive"];
                return response;
            }

            var key = TotpCryptoService.DeriveKey(this.configuration);
            if (this.ValidateCode(record, request.Code, key, out var matchedStep) == false)
            {
                await this.db.SaveChangesAsync();
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidTotpCode"];
                return response;
            }

            record.LastUsedTimeStep = matchedStep;
            record.UpdatedAt = DateTime.UtcNow;

            var oldCodes = await this.db.UserRecoveryCodes.Where(rc => rc.UserId == userId.Value).ToListAsync();
            this.db.UserRecoveryCodes.RemoveRange(oldCodes);

            var recoveryCodes = this.GenerateRecoveryCodes(userId.Value);
            await this.db.SaveChangesAsync();

            response.Data = new DTOTotp.DTOEnable { RecoveryCodes = recoveryCodes };
            response.StatusCode = HttpStatusCode.OK;
            response.Message = this.localizer["RecoveryCodesRegenerated"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<bool>> Status(HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<bool>();
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

            if (await this.permissionService.HasPermission(caller, PermissionCode.TwoFactor) == false)
            {
                response.StatusCode = HttpStatusCode.Forbidden;
                response.Message = this.localizer["TwoFactorDisabledByAdministrator"];
                return response;
            }

            var isEnabled = await this.db.UserTotps.AsNoTracking().AnyAsync(t => t.UserId == userId.Value && t.IsEnabled);
            response.Data = isEnabled;
            response.StatusCode = HttpStatusCode.OK;
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    public async Task<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>> VerifyLogin(VMTotp.VMVerifyLogin request, HttpContext httpContext)
    {
        var response = new DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>();
        try
        {
            if (string.IsNullOrWhiteSpace(request.PendingToken) ||
                GenericService.TryValidatePendingUserToken(this.configuration, request.PendingToken, out var username) == false)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["VerificationTokenInvalidOrExpired"];
                return response;
            }

            var findUser = await this.db.Users.FirstOrDefaultAsync(u => u.Username == username);
            if (findUser == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["UserNotFound"];
                return response;
            }

            var record = await this.db.UserTotps.FirstOrDefaultAsync(t => t.UserId == findUser.Id && t.IsEnabled);
            if (record == null)
            {
                response.StatusCode = HttpStatusCode.Unauthorized;
                response.Message = this.localizer["TwoFactorNotActive"];
                return response;
            }

            if (record.LockedUntil is { } lockedUntil && lockedUntil > DateTime.UtcNow)
            {
                response.StatusCode = HttpStatusCode.TooManyRequests;
                response.Message = this.localizer["TooManyFailedAttempts"];
                return response;
            }

            var key = TotpCryptoService.DeriveKey(this.configuration);
            var codeValid = this.ValidateCode(record, request.Code, key, out _);
            if (codeValid == false && await this.TryConsumeRecoveryCode(findUser.Id, request.Code) == false)
            {
                await this.db.SaveChangesAsync();
                response.StatusCode = HttpStatusCode.BadRequest;
                response.Message = this.localizer["InvalidTotpCode"];
                return response;
            }

            GenericService.CreateUserSession(this.db, this.configuration, httpContext, findUser);
            GenericService.CreateRefreshToken(this.db, this.configuration, httpContext, findUser, DateTime.UtcNow);
            await this.db.SaveChangesAsync();

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
            response.Message = this.localizer["LoginSuccess"];
        }
        catch (Exception ex)
        {
            response.StatusCode = HttpStatusCode.InternalServerError;
            response.Message = this.localizer["InternalServerError"];
        }
        return response;
    }

    // Validates the TOTP code against the decrypted secret, with a clock tolerance of +-1 step (30s),
    // anti-replay (does not allow reusing the same timestep) and lockout after consecutive failed attempts.
    private bool ValidateCode(EntityUserTotp userTotp, string code, byte[] key, out long matchedStep)
    {
        matchedStep = 0;
        if (userTotp.LockedUntil > DateTime.UtcNow)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        var secretBytes = TotpCryptoService.Decrypt(userTotp.EncryptedSecret, key);
        var totp = new OtpNet.Totp(secretBytes, step: 30, mode: OtpHashMode.Sha1, totpSize: 6);
        var isValid = totp.VerifyTotp(code, out matchedStep, new VerificationWindow(previous: 1, future: 1));

        if (isValid == false || userTotp.LastUsedTimeStep == matchedStep)
        {
            userTotp.FailedAttempts++;
            if (userTotp.FailedAttempts >= MaxFailedAttempts)
            {
                userTotp.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes);
            }
            userTotp.UpdatedAt = DateTime.UtcNow;
            return false;
        }

        userTotp.FailedAttempts = 0;
        userTotp.LockedUntil = null;
        userTotp.LastUsedTimeStep = matchedStep;
        userTotp.UpdatedAt = DateTime.UtcNow;
        return true;
    }

    private List<string> GenerateRecoveryCodes(Guid userId)
    {
        var codes = new List<string>();
        for (int i = 0; i < RecoveryCodeCount; i++)
        {
            var plain = $"{this.RandomAlphaNumeric(4)}-{this.RandomAlphaNumeric(4)}";
            codes.Add(plain);
            this.db.UserRecoveryCodes.Add(new EntityUserRecoveryCode
            {
                UserId = userId,
                CodeHash = this.passwordService.HashPassword(plain),
            });
        }
        return codes;
    }

    private async Task<bool> TryConsumeRecoveryCode(Guid userId, string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        var candidates = await this.db.UserRecoveryCodes.Where(rc => rc.UserId == userId && rc.UsedAt == null).ToListAsync();
        foreach (var candidate in candidates)
        {
            if (this.passwordService.VerifyPassword(code, candidate.CodeHash))
            {
                candidate.UsedAt = DateTime.UtcNow;
                return true;
            }
        }
        return false;
    }

    private string RandomAlphaNumeric(int length)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous characters (0,O,1,I)
        var bytes = RandomNumberGenerator.GetBytes(length);
        var result = new char[length];
        for (int i = 0; i < length; i++)
        {
            result[i] = chars[bytes[i] % chars.Length];
        }
        return new string(result);
    }
}
