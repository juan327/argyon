using ApiSqliteDemo.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Argyon.Backend.App.Shared.Entities;
using Argyon.Backend.App.Shared.IServices;

namespace Argyon.Backend.App.Shared.Services;

public class ContentLimitService : IContentLimitService
{
    // Worst-case JSON.stringify expansion: a control character (U+0000-U+001F) is escaped as
    // \uXXXX -- 1 UTF-16 code unit in -> 6 ASCII bytes out. This is the actual worst case for
    // JSON.stringify, so it's used as the per-character multiplier: astral-plane characters,
    // quote/backslash escaping, and UTF-8 multi-byte expansion are all smaller than this. The
    // margin must never be tight enough to reject a legitimate plaintext at exactly the
    // configured character limit.
    private const int WorstCaseBytesPerChar = 6;
    private const int FixedPlaintextPaddingBytes = 16;
    private const int GcmTagBytes = 16;

    private readonly DataContext db;
    private readonly IStringLocalizer<SharedResource> localizer;
    private readonly ISystemSettingsCache systemSettingsCache;

    public ContentLimitService(DataContext _db, IStringLocalizer<SharedResource> _localizer, ISystemSettingsCache _systemSettingsCache)
    {
        this.db = _db;
        this.localizer = _localizer;
        this.systemSettingsCache = _systemSettingsCache;
    }

    public async Task<EffectiveContentLimits> GetEffectiveLimits(EntityUser caller)
    {
        // The Owner is never subject to a limit.
        if (caller.RoleCode == EntityUser_RoleCode.Owner)
        {
            return new EffectiveContentLimits(null, null, null, null, null);
        }

        var settings = await this.systemSettingsCache.Get(this.db);
        var isAdministrator = caller.RoleCode == EntityUser_RoleCode.Administrator;

        // Convention shared with MaxNotesOverride/MaxFoldersOverride: null = inherits the role's
        // limit, -1 = unlimited (explicit override), >=1 = own cap.
        long? Resolve(long? overrideValue, long? administratorDefault, long? userDefault)
        {
            if (overrideValue == -1)
            {
                return null;
            }
            if (overrideValue.HasValue)
            {
                return overrideValue.Value;
            }
            return isAdministrator ? administratorDefault : userDefault;
        }

        return new EffectiveContentLimits(
            MaxNameChars: Resolve(caller.MaxNoteNameCharsOverride, settings?.MaxNoteNameCharsAdministrator, settings?.MaxNoteNameCharsUser),
            MaxDescriptionChars: Resolve(caller.MaxNoteDescriptionCharsOverride, settings?.MaxNoteDescriptionCharsAdministrator, settings?.MaxNoteDescriptionCharsUser),
            MaxTagsChars: Resolve(caller.MaxNoteTagsCharsOverride, settings?.MaxNoteTagsCharsAdministrator, settings?.MaxNoteTagsCharsUser),
            MaxDataKb: Resolve(caller.MaxNoteDataKbOverride, settings?.MaxNoteDataKbAdministrator, settings?.MaxNoteDataKbUser),
            MaxAttachmentFileSizeKb: Resolve(caller.MaxAttachmentFileSizeKbOverride, settings?.MaxAttachmentFileSizeKbAdministrator, settings?.MaxAttachmentFileSizeKbUser)
        );
    }

    public async Task<string?> ValidateAttachmentSize(EntityUser caller, long sizeBytes)
    {
        if (caller.RoleCode == EntityUser_RoleCode.Owner)
        {
            return null;
        }

        var settings = await this.systemSettingsCache.Get(this.db);
        var isAdministrator = caller.RoleCode == EntityUser_RoleCode.Administrator;

        long? Resolve(long? overrideValue, long? administratorDefault, long? userDefault)
        {
            if (overrideValue == -1)
            {
                return null;
            }
            if (overrideValue.HasValue)
            {
                return overrideValue.Value;
            }
            return isAdministrator ? administratorDefault : userDefault;
        }

        var maxAttachmentFileSizeKb = Resolve(caller.MaxAttachmentFileSizeKbOverride, settings?.MaxAttachmentFileSizeKbAdministrator, settings?.MaxAttachmentFileSizeKbUser);

        if (maxAttachmentFileSizeKb.HasValue && sizeBytes > maxAttachmentFileSizeKb.Value * 1024)
        {
            return this.localizer["AttachmentTooLarge"];
        }

        return null;
    }

    public async Task<string?> ValidateContent(EntityUser caller, string? nameCiphertext, string? descriptionCiphertext, string? tagsCiphertext, string? dataCiphertext)
    {
        if (caller.RoleCode == EntityUser_RoleCode.Owner)
        {
            return null;
        }

        var settings = await this.systemSettingsCache.Get(this.db);
        var isAdministrator = caller.RoleCode == EntityUser_RoleCode.Administrator;

        // Same override convention as GetEffectiveLimits, but resolving the precomputed *ApproxBytes*
        // columns directly -- no formula is evaluated here, it already ran once when the limit was set.
        long? Resolve(long? overrideValue, long? administratorDefault, long? userDefault)
        {
            if (overrideValue == -1)
            {
                return null;
            }
            if (overrideValue.HasValue)
            {
                return overrideValue.Value;
            }
            return isAdministrator ? administratorDefault : userDefault;
        }

        var maxNameBytes = Resolve(caller.MaxNoteNameApproxBytesOverride, settings?.MaxNoteNameApproxBytesAdministrator, settings?.MaxNoteNameApproxBytesUser);
        var maxDescriptionBytes = Resolve(caller.MaxNoteDescriptionApproxBytesOverride, settings?.MaxNoteDescriptionApproxBytesAdministrator, settings?.MaxNoteDescriptionApproxBytesUser);
        var maxTagsBytes = Resolve(caller.MaxNoteTagsApproxBytesOverride, settings?.MaxNoteTagsApproxBytesAdministrator, settings?.MaxNoteTagsApproxBytesUser);
        var maxDataKb = Resolve(caller.MaxNoteDataKbOverride, settings?.MaxNoteDataKbAdministrator, settings?.MaxNoteDataKbUser);

        if (maxNameBytes.HasValue && !string.IsNullOrEmpty(nameCiphertext) && nameCiphertext.Length > maxNameBytes.Value)
        {
            return this.localizer["NameTooLong"];
        }

        if (maxDescriptionBytes.HasValue && !string.IsNullOrEmpty(descriptionCiphertext) && descriptionCiphertext.Length > maxDescriptionBytes.Value)
        {
            return this.localizer["DescriptionTooLong"];
        }

        if (maxTagsBytes.HasValue && !string.IsNullOrEmpty(tagsCiphertext) && tagsCiphertext.Length > maxTagsBytes.Value)
        {
            return this.localizer["TagsTooLong"];
        }

        // The data field is a raw KB weight configured directly by the owner (not derived from a
        // character count), so it's compared straight against the ciphertext byte length.
        if (maxDataKb.HasValue && !string.IsNullOrEmpty(dataCiphertext) && dataCiphertext.Length > maxDataKb.Value * 1024)
        {
            return this.localizer["DataTooLarge"];
        }

        return null;
    }

    public int ComputeApproxMaxCiphertextBytes(int maxChars)
    {
        var worstCasePlaintextBytes = (maxChars * WorstCaseBytesPerChar) + FixedPlaintextPaddingBytes;
        var gcmBytes = worstCasePlaintextBytes + GcmTagBytes;
        return (int)Math.Ceiling(gcmBytes / 3.0) * 4;
    }
}
