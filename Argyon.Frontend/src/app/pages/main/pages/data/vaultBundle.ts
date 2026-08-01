export const VAULT_BUNDLE_VERSION = 2;
export const VAULT_BUNDLE_APP = 'Argyon';

export interface VaultBundleNoteBase {
    id: string;
    parentId: string | null;
    isFolder: boolean;
}

// encrypted === true: name/tags/description/data are the base64 ciphertext exactly as it
// comes from the server (same origin Vault Key), each field with its own independent iv.
export interface VaultBundleEncryptedNote extends VaultBundleNoteBase {
    name: string;
    nameIv: string;
    data: string | null;
    dataIv: string | null;
    tags: string | null;
    tagsIv: string | null;
    description: string | null;
    descriptionIv: string | null;
}

// encrypted === false: the fields are in plain text, ready to read.
export interface VaultBundlePlainNote extends VaultBundleNoteBase {
    name: string;
    data: any | null;
    tags: string | null;
    description: string | null;
}

export interface VaultBundleEncrypted {
    version: number;
    app: string;
    encrypted: true;
    exportedAt: string;
    kdf: {
        algorithm: string;
        memory: number;
        iterations: number;
        parallelism: number;
    };
    salt: string;
    encryptedVaultKeyIv: string;
    encryptedVaultKey: string;
    notes: VaultBundleEncryptedNote[];
}

export interface VaultBundlePlain {
    version: number;
    app: string;
    encrypted: false;
    exportedAt: string;
    notes: VaultBundlePlainNote[];
}

export type VaultBundle = VaultBundleEncrypted | VaultBundlePlain;

export function isVaultBundle(value: any): value is VaultBundle {
    if (value === null || typeof value !== 'object') return false;
    if (typeof value.encrypted !== 'boolean') return false;
    if (Array.isArray(value.notes) === false) return false;
    if (value.encrypted === true) {
        return typeof value.salt === 'string' &&
            typeof value.encryptedVaultKey === 'string' &&
            typeof value.encryptedVaultKeyIv === 'string' &&
            typeof value.kdf === 'object' && value.kdf !== null;
    }
    return true;
}
