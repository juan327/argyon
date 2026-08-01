export class DTOLoginResponse {
    requiresTwoFactor: boolean = false;
    pendingToken: string | null = null;
    vaultKeyInfo: DTOVaultKeyInfo | null = null;
}

export class DTOMe {
    id: string;
    username: string;
    roleCode: RoleCode;
    isBlocked: boolean;
    canManageNotes: boolean;
    canUseTwoFactor: boolean;
    // Already resolved (Owner bypass -> per-user override -> role default) by the backend; null = unlimited.
    maxNoteNameChars: number | null = null;
    maxNoteDescriptionChars: number | null = null;
    maxNoteTagsChars: number | null = null;
    maxNoteDataKb: number | null = null;
    maxAttachmentFileSizeKb: number | null = null;
    // Mirrors Jwt:AccessTokenExpiryMinutes / VaultFreshness:RequireReverifyMinutes on the backend,
    // so TokenRefreshService/VaultLockService derive their timers from the same source of truth.
    accessTokenExpiryMinutes: number = 15;
    vaultFreshnessMinutes: number = 60;

    constructor(id: string, username: string, roleCode: RoleCode, isBlocked: boolean, canManageNotes: boolean, canUseTwoFactor: boolean) {
        this.id = id;
        this.username = username;
        this.roleCode = roleCode;
        this.isBlocked = isBlocked;
        this.canManageNotes = canManageNotes;
        this.canUseTwoFactor = canUseTwoFactor;
    }
}

// Returned by POST User/Refresh.
export class DTORefreshResponse {
    vaultFresh: boolean = false;
}

export class DTOUserListItem {
    id: string;
    username: string;
    roleCode: RoleCode;
    createdAt: Date;
    isBlocked: boolean;
    maxNotesOverride: number | null;
    maxFoldersOverride: number | null;
    canManageNotesOverride: boolean | null;
    canUseTwoFactorOverride: boolean | null;
    maxNoteNameCharsOverride: number | null;
    maxNoteDescriptionCharsOverride: number | null;
    maxNoteTagsCharsOverride: number | null;
    maxNoteDataKbOverride: number | null;
    maxAttachmentFileSizeKbOverride: number | null;

    constructor(id: string, username: string, roleCode: RoleCode, createdAt: Date, isBlocked: boolean, maxNotesOverride: number | null, maxFoldersOverride: number | null, canManageNotesOverride: boolean | null, canUseTwoFactorOverride: boolean | null,
        maxNoteNameCharsOverride: number | null = null, maxNoteDescriptionCharsOverride: number | null = null, maxNoteTagsCharsOverride: number | null = null, maxNoteDataKbOverride: number | null = null, maxAttachmentFileSizeKbOverride: number | null = null) {
        this.id = id;
        this.username = username;
        this.roleCode = roleCode;
        this.createdAt = createdAt;
        this.isBlocked = isBlocked;
        this.maxNotesOverride = maxNotesOverride;
        this.maxFoldersOverride = maxFoldersOverride;
        this.canManageNotesOverride = canManageNotesOverride;
        this.canUseTwoFactorOverride = canUseTwoFactorOverride;
        this.maxNoteNameCharsOverride = maxNoteNameCharsOverride;
        this.maxNoteDescriptionCharsOverride = maxNoteDescriptionCharsOverride;
        this.maxNoteTagsCharsOverride = maxNoteTagsCharsOverride;
        this.maxNoteDataKbOverride = maxNoteDataKbOverride;
        this.maxAttachmentFileSizeKbOverride = maxAttachmentFileSizeKbOverride;
    }
}

export class DTOVaultKeyInfo {
    salt: string;
    kdfAlgorithm: string;
    kdfMemory: number;
    kdfIterations: number;
    kdfParallelism: number;
    encryptedVaultKeyIv: string;
    encryptedVaultKey: string;

    constructor(salt: string, kdfAlgorithm: string, kdfMemory: number, kdfIterations: number, kdfParallelism: number, encryptedVaultKeyIv: string, encryptedVaultKey: string) {
        this.salt = salt;
        this.kdfAlgorithm = kdfAlgorithm;
        this.kdfMemory = kdfMemory;
        this.kdfIterations = kdfIterations;
        this.kdfParallelism = kdfParallelism;
        this.encryptedVaultKeyIv = encryptedVaultKeyIv;
        this.encryptedVaultKey = encryptedVaultKey;
    }
}

// Returned by the anonymous User/Prelogin endpoint: just enough for the client to derive
// the KEK/AuthHash locally before it can send anything to Login.
export class DTOPreloginInfo {
    salt: string;
    kdfAlgorithm: string;
    kdfMemory: number;
    kdfIterations: number;
    kdfParallelism: number;

    constructor(salt: string, kdfAlgorithm: string, kdfMemory: number, kdfIterations: number, kdfParallelism: number) {
        this.salt = salt;
        this.kdfAlgorithm = kdfAlgorithm;
        this.kdfMemory = kdfMemory;
        this.kdfIterations = kdfIterations;
        this.kdfParallelism = kdfParallelism;
    }
}


// Matches EntityUser_RoleCode in the backend (Argyon.Backend/App/Shared/Entities/EntityUser.cs);
// the numeric values, not the names, are the contract serialized with the API.
export enum RoleCode {
    Owner = 1,
    Administrator = 2,
    User = 3,
}