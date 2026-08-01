using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.Services;

public enum RefreshRotationResult
{
    Invalid,
    ReuseDetected,
    Success,
}

public class GenericService
{
    private const string PendingUserTokenUse = "2fa_pending";

    private static string GenerateUserToken(IConfiguration configuration, string username, DateTime? expiresAt = null)
    {
        var jwtSetting = configuration.GetSection("Jwt");
        var password = jwtSetting.GetValue<string>("Password") ?? string.Empty;
        var salt = jwtSetting.GetValue<string>("Salt") ?? string.Empty;
        var key = JwtKeyGenerator.GenerateKey(password, salt);

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(key),
            SecurityAlgorithms.HmacSha512
        );

        var token = new JwtSecurityToken(
            issuer: jwtSetting.GetValue<string>("Issuer"),
            audience: jwtSetting.GetValue<string>("Audience"),
            claims: new[] { new Claim(ClaimTypes.Name, username) },
            expires: expiresAt ?? DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Creates the real session (EntityUserSession + access_token cookie). Extracted from Register/Login
    // so that the TOTP verification step (Totp/VerifyLogin) can reuse it in exactly the same way.
    public static (string token, DateTime expiresAt) CreateUserSession(DataContext db, IConfiguration configuration, HttpContext httpContext, EntityUser user)
    {
        var expiryMinutes = configuration.GetSection("Jwt").GetValue<double?>("AccessTokenExpiryMinutes") ?? 15;
        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);
        var token = GenerateUserToken(configuration, user.Username, expiresAt);

        db.UserSessions.Add(new EntityUserSession
        {
            Token = token,
            UserId = user.Id,
            ExpiresAt = expiresAt,
        });

        httpContext.Response.Cookies.Append("access_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = expiresAt
        });

        return (token, expiresAt);
    }

    private static string GenerateOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    // The refresh token is never stored in clear text: only its SHA-256 hash is persisted, same
    // spirit as AuthHash being Argon2id-hashed rather than kept raw.
    public static string HashToken(string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }

    // Issues a brand new refresh token family (login/register/TOTP verify). `vaultUnlockedAt` is
    // set to "now" in those flows, since proving the master password is exactly what just happened.
    public static string CreateRefreshToken(DataContext db, IConfiguration configuration, HttpContext httpContext, EntityUser user, DateTime? vaultUnlockedAt)
    {
        var expiryDays = configuration.GetSection("Jwt").GetValue<double?>("RefreshTokenExpiryDays") ?? 14;
        var rawToken = GenerateOpaqueToken();
        var expiresAt = DateTime.UtcNow.AddDays(expiryDays);

        db.RefreshTokens.Add(new EntityRefreshToken
        {
            TokenHash = HashToken(rawToken),
            UserId = user.Id,
            FamilyId = Guid.NewGuid(),
            ExpiresAt = expiresAt,
            VaultUnlockedAt = vaultUnlockedAt,
        });

        httpContext.Response.Cookies.Append("refresh_token", rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = expiresAt
        });

        return rawToken;
    }

    // Validates and rotates a refresh token (single-use). If the presented token was already
    // rotated before (IsRevoked == true), it means it was stolen/replayed: the whole rotation
    // family is revoked so every descendant token stops working, forcing a full re-login.
    // Caller is responsible for calling db.SaveChangesAsync() afterwards.
    public static async Task<(RefreshRotationResult Result, EntityRefreshToken? NewToken)> RotateRefreshToken(
        DataContext db, IConfiguration configuration, HttpContext httpContext, string? rawToken)
    {
        if (string.IsNullOrEmpty(rawToken))
        {
            return (RefreshRotationResult.Invalid, null);
        }

        var tokenHash = HashToken(rawToken);
        var existing = await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);
        if (existing == null || existing.ExpiresAt < DateTime.UtcNow)
        {
            return (RefreshRotationResult.Invalid, null);
        }

        if (existing.IsRevoked)
        {
            var familyTokens = await db.RefreshTokens
                .Where(rt => rt.FamilyId == existing.FamilyId && rt.IsRevoked == false)
                .ToListAsync();
            foreach (var familyToken in familyTokens)
            {
                familyToken.IsRevoked = true;
            }
            return (RefreshRotationResult.ReuseDetected, null);
        }

        var expiryDays = configuration.GetSection("Jwt").GetValue<double?>("RefreshTokenExpiryDays") ?? 14;
        var newRawToken = GenerateOpaqueToken();
        var newEntity = new EntityRefreshToken
        {
            TokenHash = HashToken(newRawToken),
            UserId = existing.UserId,
            FamilyId = existing.FamilyId,
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            VaultUnlockedAt = existing.VaultUnlockedAt,
        };

        existing.IsRevoked = true;
        existing.ReplacedByTokenId = newEntity.Id;
        db.RefreshTokens.Add(newEntity);

        httpContext.Response.Cookies.Append("refresh_token", newRawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = newEntity.ExpiresAt
        });

        return (RefreshRotationResult.Success, newEntity);
    }

    // Short-lived token issued after validating the password when the user has TOTP enabled.
    // It is never persisted as an EntityUserSession nor sent in a cookie: it travels in the body and is
    // only accepted by Totp/VerifyLogin (see TryValidatePendingTwoFactorToken). If someone tried
    // to use it as a normal session cookie, JwtEventsHandler would reject it anyway since no
    // corresponding row exists in user_sessions.
    public static string GeneratePendingUserToken(IConfiguration configuration, string username, DateTime expiresAt)
    {
        var jwtSetting = configuration.GetSection("Jwt");
        var key = JwtKeyGenerator.GenerateKey(
            jwtSetting.GetValue<string>("Password") ?? string.Empty,
            jwtSetting.GetValue<string>("Salt") ?? string.Empty);

        var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha512);
        var token = new JwtSecurityToken(
            issuer: jwtSetting.GetValue<string>("Issuer"),
            audience: jwtSetting.GetValue<string>("Audience"),
            claims: new[] { new Claim(ClaimTypes.Name, username), new Claim("token_use", PendingUserTokenUse) },
            expires: expiresAt,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static bool TryValidatePendingUserToken(IConfiguration configuration, string pendingUserToken, out string? username)
    {
        username = null;
        var jwtSetting = configuration.GetSection("Jwt");
        var key = JwtKeyGenerator.GenerateKey(
            jwtSetting.GetValue<string>("Password") ?? string.Empty,
            jwtSetting.GetValue<string>("Salt") ?? string.Empty);

        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSetting.GetValue<string>("Issuer"),
            ValidAudience = jwtSetting.GetValue<string>("Audience"),
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        try
        {
            var principal = new JwtSecurityTokenHandler().ValidateToken(pendingUserToken, parameters, out _);
            if (principal.FindFirst("token_use")?.Value != PendingUserTokenUse)
            {
                return false;
            }

            username = principal.FindFirst(ClaimTypes.Name)?.Value;
            return string.IsNullOrEmpty(username) == false;
        }
        catch
        {
            return false;
        }
    }
}