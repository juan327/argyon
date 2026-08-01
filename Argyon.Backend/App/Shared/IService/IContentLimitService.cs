using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Shared.IServices;

public record EffectiveContentLimits(long? MaxNameChars, long? MaxDescriptionChars, long? MaxTagsChars, long? MaxDataKb, long? MaxAttachmentFileSizeKb);

public interface IContentLimitService
{
    Task<EffectiveContentLimits> GetEffectiveLimits(EntityUser caller);

    // Returns null if the content is within limits, or a localized error message otherwise.
    // The ciphertext strings are compared against a precomputed approximate max ciphertext length
    // (see ComputeApproxMaxCiphertextBytes), never the plaintext (the backend never sees it).
    Task<string?> ValidateContent(EntityUser caller, string? nameCiphertext, string? descriptionCiphertext, string? tagsCiphertext, string? dataCiphertext);

    // Returns null if the attachment is within the effective size limit, or a localized error
    // message otherwise. Compared directly against the encrypted file's byte length (already
    // ciphertext, streamed from disk) -- same "raw KB, no precompute" treatment as MaxDataKb.
    Task<string?> ValidateAttachmentSize(EntityUser caller, long sizeBytes);

    // Computes the approximate max ciphertext (base64) length for a given character limit. Called
    // once by SettingsService/UserService whenever a character limit is set, so the result can be
    // stored alongside it (EntitySystemSettings.*ApproxBytes* / EntityUser.*ApproxBytesOverride)
    // instead of being recomputed on every note/folder create or update.
    int ComputeApproxMaxCiphertextBytes(int maxChars);
}
