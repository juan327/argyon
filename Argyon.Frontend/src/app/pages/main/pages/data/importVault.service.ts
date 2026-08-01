import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTONote, DTOUser } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { CipherService } from "src/app/shared/services/cipher.service";
import { HttpService } from "src/app/shared/services/http.service";
import { VMNote } from "src/app/shared/vm";
import { isVaultBundle, VaultBundle, VaultBundleEncryptedNote, VaultBundlePlainNote } from "./vaultBundle";
import { TranslateService } from "@ngx-translate/core";

@Injectable({ providedIn: 'any' })

export class ImportVaultService {

  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);
  private readonly cipherService = inject(CipherService);
  private readonly _translate = inject(TranslateService);

  public async ParseFile(file: File): Promise<{ message: string, success: boolean, bundle?: VaultBundle }> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (isVaultBundle(parsed) === false) {
        return { message: this._translate.instant('data.invalidExportFormat'), success: false };
      }
      return { message: this._translate.instant('data.validFile'), success: true, bundle: parsed };
    }
    catch (error: any) {
      console.error(error);
      return { message: this._translate.instant('data.couldNotReadFile'), success: false };
    }
  }

  public async Import(bundle: VaultBundle, filePassword: string | null, targetParentId: string | null): Promise<{ message: string, success: boolean }> {
    if (bundle.notes.length === 0) {
      return { message: this._translate.instant('data.noNotesToImport'), success: false };
    }

    let items: VMNote.VMImportItem[];
    try {
      items = bundle.encrypted === true
        ? await this.BuildItemsFromEncrypted(bundle.notes, bundle, filePassword)
        : await this.BuildItemsFromPlain(bundle.notes);
    }
    catch (error: any) {
      console.error(error);
      return { message: this._translate.instant('data.incorrectFilePassword'), success: false };
    }

    const model: VMNote.VMImport = { items, targetParentId };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTONote.DTOImportResult>>('Note/Import', model);
    if (success === false) {
      return { message: response.message, success: false };
    }

    return { message: this.buildSummaryMessage(response.data), success: true };
  }

  private async BuildItemsFromEncrypted(notes: VaultBundleEncryptedNote[], bundle: { kdf: { algorithm: string, memory: number, iterations: number, parallelism: number }, salt: string, encryptedVaultKeyIv: string, encryptedVaultKey: string }, filePassword: string | null): Promise<VMNote.VMImportItem[]> {
    if (filePassword === null) {
      throw new Error(this._translate.instant('data.encryptedFileNeedsPassword'));
    }

    const info: DTOUser.DTOVaultKeyInfo = {
      salt: bundle.salt,
      kdfAlgorithm: bundle.kdf.algorithm,
      kdfMemory: bundle.kdf.memory,
      kdfIterations: bundle.kdf.iterations,
      kdfParallelism: bundle.kdf.parallelism,
      encryptedVaultKeyIv: bundle.encryptedVaultKeyIv,
      encryptedVaultKey: bundle.encryptedVaultKey,
    };

    const sourceVaultKeyRaw = await this.authService.UnwrapVaultKeyRaw(filePassword, info);
    const sourceKey = await this.authService.ImportRawKeyAsCryptoKey(sourceVaultKeyRaw);

    return Promise.all(notes.map(async note => {
      const sourceNameIv = this.cipherService.ConvertBase64ToUint8Array(note.nameIv);
      const sourceTagsIv = this.cipherService.ConvertBase64ToUint8Array(note.tagsIv);
      const sourceDescriptionIv = this.cipherService.ConvertBase64ToUint8Array(note.descriptionIv);
      const name = await this.cipherService.Decrypt(note.name, sourceNameIv, sourceKey);
      const tags = await this.cipherService.Decrypt(note.tags, sourceTagsIv, sourceKey);
      const description = await this.cipherService.Decrypt(note.description, sourceDescriptionIv, sourceKey);
      const sourceDataIv = this.cipherService.ConvertBase64ToUint8Array(note.dataIv);
      const data = note.data !== null ? await this.cipherService.Decrypt(note.data, sourceDataIv, sourceKey) : null;

      const newNameIv = this.cipherService.GenerateIv();
      const newDataIv = this.cipherService.GenerateIv();
      const newTagsIv = this.cipherService.GenerateIv();
      const newDescriptionIv = this.cipherService.GenerateIv();
      const item: VMNote.VMImportItem = {
        tempId: note.id,
        parentTempId: note.parentId,
        isFolder: note.isFolder,
        name: await this.cipherService.Encrypt(name, newNameIv.iv),
        nameIv: newNameIv.ivBase64,
        tags: await this.cipherService.Encrypt(tags, newTagsIv.iv),
        tagsIv: newTagsIv.ivBase64,
        description: await this.cipherService.Encrypt(description, newDescriptionIv.iv),
        descriptionIv: newDescriptionIv.ivBase64,
        data: data !== null ? await this.cipherService.Encrypt(data, newDataIv.iv) : null,
        dataIv: data !== null ? newDataIv.ivBase64 : null,
      };
      return item;
    }));
  }

  private async BuildItemsFromPlain(notes: VaultBundlePlainNote[]): Promise<VMNote.VMImportItem[]> {
    return Promise.all(notes.map(async note => {
      const newNameIv = this.cipherService.GenerateIv();
      const newDataIv = this.cipherService.GenerateIv();
      const newTagsIv = this.cipherService.GenerateIv();
      const newDescriptionIv = this.cipherService.GenerateIv();
      const dataJson = note.data !== null ? JSON.stringify(note.data) : null;

      const item: VMNote.VMImportItem = {
        tempId: note.id,
        parentTempId: note.parentId,
        isFolder: note.isFolder,
        name: await this.cipherService.Encrypt(note.name ?? '', newNameIv.iv),
        nameIv: newNameIv.ivBase64,
        tags: await this.cipherService.Encrypt(note.tags ?? '', newTagsIv.iv),
        tagsIv: newTagsIv.ivBase64,
        description: await this.cipherService.Encrypt(note.description ?? '', newDescriptionIv.iv),
        descriptionIv: newDescriptionIv.ivBase64,
        data: dataJson !== null ? await this.cipherService.Encrypt(dataJson, newDataIv.iv) : null,
        dataIv: dataJson !== null ? newDataIv.ivBase64 : null,
      };
      return item;
    }));
  }

  private buildSummaryMessage(result: DTONote.DTOImportResult): string {
    if (result.failedTempIds.length > 0) {
      return this._translate.instant('data.importSummaryPartial', { imported: result.importedCount, failed: result.failedTempIds.length });
    }
    return this._translate.instant('data.importSummarySuccess', { count: result.importedCount });
  }

}
