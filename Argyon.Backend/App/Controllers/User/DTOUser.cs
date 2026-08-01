using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Controllers.User;

public class DTOUser
{
    public class DTOVaultKeyInfo
    {
        public byte[] Salt { get; set; }
        public string KdfAlgorithm { get; set; }
        public int KdfMemory { get; set; }
        public int KdfIterations { get; set; }
        public int KdfParallelism { get; set; }
        public byte[] EncryptedVaultKeyIv { get; set; }
        public string EncryptedVaultKey { get; set; }
    }

    public class DTOPreloginInfo
    {
        public byte[] Salt { get; set; }
        public string KdfAlgorithm { get; set; }
        public int KdfMemory { get; set; }
        public int KdfIterations { get; set; }
        public int KdfParallelism { get; set; }
    }

    public class DTOLoginResponse
    {
        public bool RequiresTwoFactor { get; set; }
        public string? PendingToken { get; set; }
        public DTOVaultKeyInfo? VaultKeyInfo { get; set; }
    }

    public class DTOMe
    {
        public Guid Id { get; set; }
        public string Username { get; set; }
        public EntityUser_RoleCode RoleCode { get; set; }
        public bool IsBlocked { get; set; }
        public bool CanManageNotes { get; set; }
        public bool CanUseTwoFactor { get; set; }
        // Already resolved (Owner bypass -> per-user override -> role default); null = unlimited.
        public long? MaxNoteNameChars { get; set; }
        public long? MaxNoteDescriptionChars { get; set; }
        public long? MaxNoteTagsChars { get; set; }
        public long? MaxNoteDataKb { get; set; }
        public long? MaxAttachmentFileSizeKb { get; set; }
        // Mirrors Jwt:AccessTokenExpiryMinutes / VaultFreshness:RequireReverifyMinutes so the
        // frontend derives its own refresh/lock timers from the same source of truth as the backend.
        public double AccessTokenExpiryMinutes { get; set; }
        public double VaultFreshnessMinutes { get; set; }
    }

    public class DTORefreshResponse
    {
        public bool VaultFresh { get; set; }
    }

    public class DTOUserList
    {
        public Guid Id { get; set; }
        public string Username { get; set; }
        public EntityUser_RoleCode RoleCode { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsBlocked { get; set; }
        public long? MaxNotesOverride { get; set; }
        public long? MaxFoldersOverride { get; set; }
        public bool? CanManageNotesOverride { get; set; }
        public bool? CanUseTwoFactorOverride { get; set; }
        public long? MaxNoteNameCharsOverride { get; set; }
        public long? MaxNoteDescriptionCharsOverride { get; set; }
        public long? MaxNoteTagsCharsOverride { get; set; }
        public long? MaxNoteDataKbOverride { get; set; }
        public long? MaxAttachmentFileSizeKbOverride { get; set; }
    }
}