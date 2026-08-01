import { inject, Injectable } from "@angular/core";
import { DTONote } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { CipherService } from "src/app/shared/services/cipher.service";
import { HttpService } from "src/app/shared/services/http.service";
import { VAULT_BUNDLE_APP, VAULT_BUNDLE_VERSION, VaultBundleEncrypted, VaultBundlePlain } from "./vaultBundle";
import { TranslateService } from "@ngx-translate/core";

@Injectable({ providedIn: 'any' })

export class ExportVaultService {

  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);
  private readonly cipherService = inject(CipherService);
  private readonly _translate = inject(TranslateService);

  /**
   * Exports the encrypted vault. Reuses as-is the already encrypted content that
   * the server returns (there is no need to decrypt/re-encrypt anything) and only
   * wraps the Vault Key with the password chosen for the file.
   *
   * `kek` must already have been derived and verified against the session's cached wrap info
   * (see `AuthService.ValidateMasterPasswordLocally`) - this method does not re-prove the
   * password, it only reuses that already-derived key to (optionally) rewrap the Vault Key.
   */
  public async BuildEncryptedBundle(kek: CryptoKey, exportPassword: string | null): Promise<{ message: string, success: boolean, bundle?: VaultBundleEncrypted }> {
    const currentInfo = this.authService.vaultKeyInfo;
    if (currentInfo === null) {
      return { message: this._translate.instant('data.exportPasswordPrepFailed'), success: false };
    }

    let wrapInfo = currentInfo;

    if (exportPassword !== null) {
      const rewrap = await this.authService.ChangePassword(kek, exportPassword, currentInfo);
      if (rewrap.success === false) {
        return { message: this._translate.instant('data.exportPasswordPrepFailed'), success: false };
      }
      wrapInfo = {
        salt: rewrap.salt!,
        kdfAlgorithm: rewrap.kdfAlgorithm!,
        kdfMemory: rewrap.kdfMemory!,
        kdfIterations: rewrap.kdfIterations!,
        kdfParallelism: rewrap.kdfParallelism!,
        encryptedVaultKeyIv: rewrap.encryptedVaultKeyIv!,
        encryptedVaultKey: rewrap.encryptedVaultKey!,
      };
    }

    const syncNotes: DTONote.DTOGet[] = [];
    const stream = this.httpService.Stream<DTONote.DTOGet>('Note', batch => {
      syncNotes.push(...batch);
    });
    const { success: syncSuccess, message: syncMessage } = await stream.done;
    if (syncSuccess === false) {
      return { message: syncMessage, success: false };
    }

    const bundle: VaultBundleEncrypted = {
      version: VAULT_BUNDLE_VERSION,
      app: VAULT_BUNDLE_APP,
      encrypted: true,
      exportedAt: new Date().toISOString(),
      kdf: {
        algorithm: wrapInfo.kdfAlgorithm,
        memory: wrapInfo.kdfMemory,
        iterations: wrapInfo.kdfIterations,
        parallelism: wrapInfo.kdfParallelism,
      },
      salt: wrapInfo.salt,
      encryptedVaultKeyIv: wrapInfo.encryptedVaultKeyIv,
      encryptedVaultKey: wrapInfo.encryptedVaultKey,
      notes: syncNotes.map(note => ({
        id: note.id,
        parentId: note.parentId,
        isFolder: note.isFolder,
        name: note.name,
        nameIv: note.nameIv,
        data: note.data,
        dataIv: note.dataIv,
        tags: note.tags,
        tagsIv: note.tagsIv,
        description: note.description,
        descriptionIv: note.descriptionIv,
      })),
    };

    return { message: this._translate.instant('data.exportGenerated'), success: true, bundle };
  }

  /**
   * Exports the vault unencrypted: decrypts each note with the active Vault Key
   * of the session (does not require a password, it is already unlocked).
   */
  public async BuildPlainBundle(): Promise<{ message: string, success: boolean, bundle?: VaultBundlePlain }> {
    const syncNotes: DTONote.DTOGet[] = [];
    const stream = this.httpService.Stream<DTONote.DTOGet>('Note', batch => {
      syncNotes.push(...batch);
    });
    const { success: syncSuccess, message: syncMessage } = await stream.done;
    if (syncSuccess === false) {
      return { message: syncMessage, success: false };
    }

    const notes = await Promise.all(syncNotes.map(async note => {
      const nameIv = this.cipherService.ConvertBase64ToUint8Array(note.nameIv);
      const tagsIv = this.cipherService.ConvertBase64ToUint8Array(note.tagsIv);
      const descriptionIv = this.cipherService.ConvertBase64ToUint8Array(note.descriptionIv);

      let data: any = null;
      if (note.data !== null) {
        const dataIv = this.cipherService.ConvertBase64ToUint8Array(note.dataIv);
        const dataJson = await this.cipherService.Decrypt(note.data, dataIv);
        data = JSON.parse(dataJson);
      }

      return {
        id: note.id,
        parentId: note.parentId,
        isFolder: note.isFolder,
        name: await this.cipherService.Decrypt(note.name, nameIv),
        data,
        tags: await this.cipherService.Decrypt(note.tags, tagsIv),
        description: await this.cipherService.Decrypt(note.description, descriptionIv),
      };
    }));

    const bundle: VaultBundlePlain = {
      version: VAULT_BUNDLE_VERSION,
      app: VAULT_BUNDLE_APP,
      encrypted: false,
      exportedAt: new Date().toISOString(),
      notes,
    };

    return { message: this._translate.instant('data.exportGenerated'), success: true, bundle };
  }

}
