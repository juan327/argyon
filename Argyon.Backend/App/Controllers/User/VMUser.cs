using Argyon.Backend.App.Shared.Entities;

namespace Argyon.Backend.App.Controllers.User;

public class VMUser
{
    public class VMRegister
    {
        public string Username { get; set; }
        public string AuthHash { get; set; }
        public byte[] Salt { get; set; }
        public string KdfAlgorithm { get; set; }
        public int KdfMemory { get; set; }
        public int KdfIterations { get; set; }
        public int KdfParallelism { get; set; }
        public byte[] EncryptedVaultKeyIv { get; set; }
        public string EncryptedVaultKey { get; set; }
    }

    public class VMLogin
    {
        public string Username { get; set; }
        public string AuthHash { get; set; }
    }

    public class VMValidatePassword
    {
        public string AuthHash { get; set; }
    }

    public class VMChangePassword
    {
        public string CurrentAuthHash { get; set; }
        public string NewAuthHash { get; set; }
        public byte[] Salt { get; set; }
        public string KdfAlgorithm { get; set; }
        public int KdfMemory { get; set; }
        public int KdfIterations { get; set; }
        public int KdfParallelism { get; set; }
        public byte[] EncryptedVaultKeyIv { get; set; }
        public string EncryptedVaultKey { get; set; }
    }

    public class VMPrelogin
    {
        public string Username { get; set; }
    }

    public class VMList
    {
        public int Skip { get; set; } = 0;
        public int Take { get; set; } = 10;
        public string? Search { get; set; }
    }

    public class VMChangeRole
    {
        public Guid UserId { get; set; }
        public EntityUser_RoleCode RoleCode { get; set; }
    }

    public class VMDelete
    {
        public Guid UserId { get; set; }
    }

    public class VMCreate
    {
        public string Username { get; set; }
        public string AuthHash { get; set; }
        public EntityUser_RoleCode RoleCode { get; set; }
        public byte[] Salt { get; set; }
        public string KdfAlgorithm { get; set; }
        public int KdfMemory { get; set; }
        public int KdfIterations { get; set; }
        public int KdfParallelism { get; set; }
        public byte[] EncryptedVaultKeyIv { get; set; }
        public string EncryptedVaultKey { get; set; }
    }

    public class VMSetBlocked
    {
        public Guid UserId { get; set; }
        public bool IsBlocked { get; set; }
    }

    public class VMSetLimits
    {
        public Guid UserId { get; set; }
        public int? MaxNotesOverride { get; set; }
        public int? MaxFoldersOverride { get; set; }
    }

    public class VMSetPermissions
    {
        public Guid UserId { get; set; }
        public bool? CanManageNotesOverride { get; set; }
        public bool? CanUseTwoFactorOverride { get; set; }
    }

    public class VMSetContentLimits
    {
        public Guid UserId { get; set; }
        public int? MaxNoteNameCharsOverride { get; set; }
        public int? MaxNoteDescriptionCharsOverride { get; set; }
        public int? MaxNoteTagsCharsOverride { get; set; }
        public int? MaxNoteDataKbOverride { get; set; }
        public int? MaxAttachmentFileSizeKbOverride { get; set; }
    }
}