import { computed, inject, Injectable, signal } from "@angular/core";
import argon2 from "argon2-browser/dist/argon2-bundled.min.js";
import { HttpService } from "./http.service";
import { DTOGeneric, DTOUser } from "../dto";
import { TranslateService } from "@ngx-translate/core";

const KDF_ALGORITHM = "argon2id";
const KDF_MEMORY = 64 * 1024; // 64 MB
const KDF_ITERATIONS = 3;
const KDF_PARALLELISM = 1;
const KDF_HASH_LENGTH = 32;

// HKDF "info" labels used to split the Argon2id Master Key into purpose-specific keys, so the
// same underlying secret is never reused for two different jobs (wrapping the Vault Key vs.
// proving knowledge of the password to the server).
const HKDF_INFO_KEK = "argyon-kek-v1";
const HKDF_INFO_AUTH = "argyon-auth-v1";

export interface VaultCreationResult {
  success: boolean;
  message: string;
  vaultKeyRaw?: ArrayBuffer;
  salt?: string;
  kdfAlgorithm?: string;
  kdfMemory?: number;
  kdfIterations?: number;
  kdfParallelism?: number;
  encryptedVaultKeyIv?: string;
  encryptedVaultKey?: string;
  // base64(AuthKey): the only password-derived value that is ever sent to the server.
  authHash?: string;
}

export interface AuthMaterial {
  // KEK (key-encryption-key): derived from the master password, it never leaves the client
  // and is only used to wrap/unwrap the Vault Key.
  kek: CryptoKey;
  // base64(AuthKey): a second, independent key derived from the same Master Key, used only to
  // prove knowledge of the password to the server. The server never sees the password itself.
  authHash: string;
}

@Injectable({ providedIn: 'root' })

export class AuthService {
  private readonly httpService = inject(HttpService);
  private readonly _translate = inject(TranslateService);

  // Vault Key (DEK): the key that actually encrypts/decrypts the notes.
  // It is never derived directly from the password, it is unwrapped with the KEK.
  public cryptoKey: CryptoKey | null = null;
  public unlocked = signal(false);

  // Wrap info (salt/kdf/wrapped key) used to activate the current session's Vault Key. Cached
  // so flows that need to re-prove the master password later (e.g. export) can do so purely
  // locally - deriving a KEK and attempting to unwrap this blob - without another server round trip.
  public vaultKeyInfo: DTOUser.DTOVaultKeyInfo | null = null;

  // Info of the authenticated user (username/role): used by the nav and the guards
  // to decide what to show, it does not take part in encrypting the notes.
  public currentUser = signal<DTOUser.DTOMe | null>(null);
  public canManageUsers = computed(() => this.currentUser()?.roleCode === DTOUser.RoleCode.Owner);
  public canViewUsersModule = computed(() => {
    const role = this.currentUser()?.roleCode;
    return role === DTOUser.RoleCode.Owner || role === DTOUser.RoleCode.Administrator;
  });
  // Matches canViewUsersModule: who can create/block (Owner or Administrator) is the
  // same set of roles that can see the module, since GET /api/User already scales visibility.
  public canCreateUsers = this.canViewUsersModule;
  // A blocked account can only export its data (see BlockedUserRestrictionMiddleware
  // in the backend, which applies the same restriction at the API level).
  public isBlocked = computed(() => this.currentUser()?.isBlocked === true);

  // Permissions already resolved (role + override) by the backend; defaults to `true` while
  // currentUser() has not loaded yet, so as not to hide controls prematurely.
  public canManageNotes = computed(() => this.currentUser()?.canManageNotes ?? true);
  public canUseTwoFactor = computed(() => this.currentUser()?.canUseTwoFactor ?? true);

  // Already resolved (Owner bypass -> per-user override -> role default) by the backend; null = unlimited.
  public maxNoteNameChars = computed(() => this.currentUser()?.maxNoteNameChars ?? null);
  public maxNoteDescriptionChars = computed(() => this.currentUser()?.maxNoteDescriptionChars ?? null);
  public maxNoteTagsChars = computed(() => this.currentUser()?.maxNoteTagsChars ?? null);
  public maxNoteDataKb = computed(() => this.currentUser()?.maxNoteDataKb ?? null);
  public maxAttachmentFileSizeKb = computed(() => this.currentUser()?.maxAttachmentFileSizeKb ?? null);

  public async LoadCurrentUser(): Promise<void> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiData<DTOUser.DTOMe>>('User/Me');
    if (success) {
      this.currentUser.set(response.data);
    }
  }

  private bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  // Master Key: the raw Argon2id output. It must never be used directly to encrypt/authenticate
  // anything - it is only ever expanded via HKDF into purpose-specific keys (see DeriveAuthMaterial).
  private async deriveMasterKeyBytes(password: string, salt: Uint8Array, mem: number, time: number, parallelism: number): Promise<ArrayBuffer> {
    const result = await argon2.hash({
      pass: password,
      salt: salt,
      time: time,
      mem: mem,
      hashLen: KDF_HASH_LENGTH,
      parallelism: parallelism,
      type: argon2.ArgonType.Argon2id
    });

    // Copy into a fresh, exact-length buffer: result.hash may be a view into a larger
    // wasm-owned buffer, and importKey("raw", ...) requires the byte length to match exactly.
    return Uint8Array.from(result.hash as Uint8Array).buffer;
  }

  // Expands the Master Key into an independent, fixed-purpose key via HKDF-SHA256, so the KEK
  // and the AuthKey can never be confused with (or derived from) one another.
  private async hkdfExpand(masterKeyBytes: ArrayBuffer, infoLabel: string, lengthBytes: number): Promise<ArrayBuffer> {
    const hkdfKey = await crypto.subtle.importKey("raw", masterKeyBytes, "HKDF", false, ["deriveBits"]);
    return crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(infoLabel),
      },
      hkdfKey,
      lengthBytes * 8
    );
  }

  /**
   * Runs Argon2id once and expands the result into the KEK (used to wrap/unwrap the Vault Key,
   * never leaves the client) and the AuthKey (base64-encoded as `authHash`, the only
   * password-derived value ever sent to the server). Replaces the old single-purpose `deriveKek`.
   */
  public async DeriveAuthMaterial(password: string, salt: Uint8Array, mem: number, time: number, parallelism: number): Promise<AuthMaterial> {
    const masterKeyBytes = await this.deriveMasterKeyBytes(password, salt, mem, time, parallelism);

    const kekBytes = await this.hkdfExpand(masterKeyBytes, HKDF_INFO_KEK, 32);
    const kek = await crypto.subtle.importKey("raw", kekBytes, "AES-GCM", false, ["encrypt", "decrypt"]);

    const authKeyBytes = await this.hkdfExpand(masterKeyBytes, HKDF_INFO_AUTH, 32);
    const authHash = this.bytesToBase64(new Uint8Array(authKeyBytes));

    return { kek, authHash };
  }

  /**
   * Fetches the KDF salt/parameters for `username` from the anonymous User/Prelogin endpoint, so
   * the client can derive its AuthMaterial before sending anything to the server. Fails with a
   * generic "invalid credentials" message if the username does not exist.
   */
  public async FetchPreloginParams(username: string): Promise<{ success: boolean, message: string, info?: DTOUser.DTOPreloginInfo }> {
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOPreloginInfo>>('User/Prelogin', { username });
    if (success === false) {
      return { message: response.message, success: false };
    }
    return { message: response.message, success: true, info: response.data };
  }

  /**
   * Convenience helper for flows that only have a username + a password typed by the user
   * (login, unlock, re-authenticating before a sensitive action): fetches the KDF params via
   * Prelogin and derives the AuthMaterial in one call.
   */
  public async DeriveAuthHashForUser(username: string, password: string): Promise<{ success: boolean, message: string, kek?: CryptoKey, authHash?: string, preloginInfo?: DTOUser.DTOPreloginInfo }> {
    const prelogin = await this.FetchPreloginParams(username);
    if (prelogin.success === false || prelogin.info === undefined) {
      return { message: prelogin.message, success: false };
    }

    const salt = this.base64ToBytes(prelogin.info.salt);
    const material = await this.DeriveAuthMaterial(password, salt, prelogin.info.kdfMemory, prelogin.info.kdfIterations, prelogin.info.kdfParallelism);
    return { success: true, message: '', kek: material.kek, authHash: material.authHash, preloginInfo: prelogin.info };
  }

  /**
   * Wraps a (raw) Vault Key with a new KEK derived from `password`,
   * always using the app's current KDF parameters. Generates its own random salt: used
   * for registration and for choosing a brand new password, neither of which needs Prelogin.
   */
  private async wrapVaultKey(password: string, vaultKeyRaw: ArrayBuffer): Promise<Required<Omit<VaultCreationResult, 'success' | 'message' | 'vaultKeyRaw'>>> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const material = await this.DeriveAuthMaterial(password, salt, KDF_MEMORY, KDF_ITERATIONS, KDF_PARALLELISM);

    const wrapIv = crypto.getRandomValues(new Uint8Array(16));
    const wrappedVaultKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, material.kek, vaultKeyRaw);

    return {
      salt: this.bytesToBase64(salt),
      kdfAlgorithm: KDF_ALGORITHM,
      kdfMemory: KDF_MEMORY,
      kdfIterations: KDF_ITERATIONS,
      kdfParallelism: KDF_PARALLELISM,
      encryptedVaultKeyIv: this.bytesToBase64(wrapIv),
      encryptedVaultKey: this.bytesToBase64(new Uint8Array(wrappedVaultKey)),
      authHash: material.authHash,
    };
  }

  /**
   * Derives the KEK from `password` and from the information returned by the
   * server (or included in an export bundle), and uses it to
   * unwrap the corresponding Vault Key. Throws if the password is
   * incorrect or the blob is corrupt (AES-GCM fails the tag verification).
   * Public because the export/import module also uses it to
   * unwrap the Vault Key of a file exported with a different password.
   */
  public async UnwrapVaultKeyRaw(password: string, info: DTOUser.DTOVaultKeyInfo): Promise<ArrayBuffer> {
    const salt = this.base64ToBytes(info.salt);
    const material = await this.DeriveAuthMaterial(password, salt, info.kdfMemory, info.kdfIterations, info.kdfParallelism);
    return this.UnwrapVaultKeyWithKek(material.kek, info);
  }

  /**
   * Same as `UnwrapVaultKeyRaw` but takes an already-derived KEK, skipping a second (expensive)
   * Argon2id run. Used by login/unlock/change-password flows that already derived the KEK once
   * via `DeriveAuthHashForUser` to build the `authHash` sent to the server.
   */
  public async UnwrapVaultKeyWithKek(kek: CryptoKey, info: DTOUser.DTOVaultKeyInfo): Promise<ArrayBuffer> {
    const wrapIv = this.base64ToBytes(info.encryptedVaultKeyIv);
    const wrappedVaultKey = this.base64ToBytes(info.encryptedVaultKey);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: wrapIv }, kek, wrappedVaultKey);
  }

  /**
   * Generates a new Vault Key and wraps it with a KEK derived from `password`.
   * It does not mutate the session state: it is used before confirming registration on the
   * server, so as not to leave the app "unlocked" if registration fails.
   */
  public async CreateVault(password: string): Promise<VaultCreationResult> {
    try {
      const vaultKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const vaultKeyRaw = await crypto.subtle.exportKey("raw", vaultKey);

      const wrap = await this.wrapVaultKey(password, vaultKeyRaw);

      return {
        success: true,
        message: this._translate.instant('auth.vaultCreated'),
        vaultKeyRaw,
        ...wrap,
      };
    }
    catch (error: any) {
      console.error(error);
      return { success: false, message: this._translate.instant('auth.masterKeyGenerationError') };
    }
  }

  /**
   * Imports a (raw) Vault Key as a non-extractable CryptoKey usable for
   * encrypting/decrypting. It is used both to activate the session key and
   * to operate on a one-off basis with the Vault Key of an imported file, without
   * making it the active session key.
   */
  public async ImportRawKeyAsCryptoKey(vaultKeyRaw: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      "raw",
      vaultKeyRaw,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Activates an already obtained Vault Key (generated or unwrapped) as the
   * session key used by CipherService to encrypt/decrypt notes.
   */
  public async ActivateVaultKey(vaultKeyRaw: ArrayBuffer, info: DTOUser.DTOVaultKeyInfo | null = null): Promise<void> {
    this.cryptoKey = await this.ImportRawKeyAsCryptoKey(vaultKeyRaw);
    this.vaultKeyInfo = info;
    this.unlocked.set(true);
  }

  /**
   * Derives the KEK from the password and the parameters returned by the
   * server, and uses it to unwrap the Vault Key. Used by flows that only have a raw
   * password + info in hand (e.g. unwrapping an imported file's Vault Key).
   */
  public async UnlockVault(password: string, info: DTOUser.DTOVaultKeyInfo): Promise<{ message: string, success: boolean }> {
    try {
      const vaultKeyRaw = await this.UnwrapVaultKeyRaw(password, info);
      await this.ActivateVaultKey(vaultKeyRaw, info);
      return { message: this._translate.instant('auth.masterKeyGenerated'), success: true };
    }
    catch (error: any) {
      console.error(error);
      return { message: this._translate.instant('auth.incorrectPassword'), success: false };
    }
  }

  /**
   * Same as `UnlockVault` but takes an already-derived KEK (see `UnwrapVaultKeyWithKek`),
   * skipping a second Argon2id run. Used by login/unlock, which already derived the KEK once
   * to build the `authHash` sent to the server.
   */
  public async ActivateVaultKeyFromKek(kek: CryptoKey, info: DTOUser.DTOVaultKeyInfo): Promise<{ message: string, success: boolean }> {
    try {
      const vaultKeyRaw = await this.UnwrapVaultKeyWithKek(kek, info);
      await this.ActivateVaultKey(vaultKeyRaw, info);
      return { message: this._translate.instant('auth.masterKeyGenerated'), success: true };
    }
    catch (error: any) {
      console.error(error);
      return { message: this._translate.instant('auth.incorrectPassword'), success: false };
    }
  }

  /**
   * Re-proves the master password entirely on the client: derives a KEK from `password` and
   * the currently cached wrap info (captured when the session's Vault Key was last activated)
   * and attempts to unwrap it. AES-GCM tag verification failing (wrong password) is the only
   * failure mode, so no server round trip is needed. Used by flows that must re-confirm the
   * user's identity for a sensitive action (e.g. export) without leaving the "local-only" model.
   */
  public async ValidateMasterPasswordLocally(password: string): Promise<{ success: boolean, message: string, kek?: CryptoKey, authHash?: string }> {
    if (this.vaultKeyInfo === null) {
      return { success: false, message: this._translate.instant('auth.incorrectPassword') };
    }

    try {
      const salt = this.base64ToBytes(this.vaultKeyInfo.salt);
      const material = await this.DeriveAuthMaterial(password, salt, this.vaultKeyInfo.kdfMemory, this.vaultKeyInfo.kdfIterations, this.vaultKeyInfo.kdfParallelism);
      await this.UnwrapVaultKeyWithKek(material.kek, this.vaultKeyInfo);
      return { success: true, message: '', kek: material.kek, authHash: material.authHash };
    }
    catch (error: any) {
      console.error(error);
      return { success: false, message: this._translate.instant('auth.currentPasswordIncorrect') };
    }
  }

  /**
   * Changes the master password: unwraps the current Vault Key with the already-derived
   * current KEK (see `DeriveAuthHashForUser`, reused to avoid re-running Argon2id for the
   * current password) and wraps it again with a KEK derived from the new password. The Vault
   * Key itself does not change, so the notes do not need to be re-encrypted.
   */
  public async ChangePassword(currentKek: CryptoKey, newPassword: string, info: DTOUser.DTOVaultKeyInfo): Promise<VaultCreationResult> {
    try {
      const vaultKeyRaw = await this.UnwrapVaultKeyWithKek(currentKek, info);
      const wrap = await this.wrapVaultKey(newPassword, vaultKeyRaw);

      return {
        success: true,
        message: this._translate.instant('auth.passwordUpdated'),
        vaultKeyRaw,
        ...wrap,
      };
    }
    catch (error: any) {
      console.error(error);
      return { success: false, message: this._translate.instant('auth.currentPasswordIncorrect') };
    }
  }

  /**
   * Clears the Vault Key from memory and flips `unlocked` back to `false`, showing the same
   * `<partial-unlock/>` gate the app already shows on a fresh reload. Used both by explicit
   * logout and by the forced re-authentication timer (VaultLockService).
   */
  public Lock(): void {
    this.cryptoKey = null;
    this.vaultKeyInfo = null;
    this.unlocked.set(false);
  }

  public async Logout(): Promise<void> {
    await this.httpService.Post<DTOGeneric.DTOResponseApi>('User/Logout', {});
    this.currentUser.set(null);
    this.Lock();
  }


}
