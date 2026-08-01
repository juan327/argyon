import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { HttpService } from "src/app/shared/services/http.service";
import { VMUser } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class ChangePasswordService {

  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);

  public async ChangePassword(username: string, model: { currentPassword: string, newPassword: string }): Promise<{ message: string, success: boolean }> {
    // Derived once: reused both to prove the current password to the server (authHash) and
    // to unwrap the current Vault Key locally (kek), instead of running Argon2id twice.
    const material = await this.authService.DeriveAuthHashForUser(username, model.currentPassword);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const validateRequest: VMUser.VMValidatePassword = { authHash: material.authHash! };
    const { response: vaultKeyInfo, success: validateSuccess } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('User/ValidatePassword', validateRequest);
    if (validateSuccess === false) {
      return { message: vaultKeyInfo.message, success: false };
    }

    const rewrap = await this.authService.ChangePassword(material.kek!, model.newPassword, vaultKeyInfo.data);
    if (rewrap.success === false) {
      return { message: rewrap.message, success: false };
    }

    const request: VMUser.VMChangePassword = {
      currentAuthHash: material.authHash!,
      newAuthHash: rewrap.authHash!,
      salt: rewrap.salt!,
      kdfAlgorithm: rewrap.kdfAlgorithm!,
      kdfMemory: rewrap.kdfMemory!,
      kdfIterations: rewrap.kdfIterations!,
      kdfParallelism: rewrap.kdfParallelism!,
      encryptedVaultKeyIv: rewrap.encryptedVaultKeyIv!,
      encryptedVaultKey: rewrap.encryptedVaultKey!,
    };

    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApi>('User/ChangePassword', request);
    if (success === false) {
      return { message: response.message, success: false };
    }

    // Keep the cached wrap info (used for local re-validation, e.g. export) in sync with the
    // password just set on the server - otherwise it would still point at the old wrapping.
    this.authService.vaultKeyInfo = {
      salt: rewrap.salt!,
      kdfAlgorithm: rewrap.kdfAlgorithm!,
      kdfMemory: rewrap.kdfMemory!,
      kdfIterations: rewrap.kdfIterations!,
      kdfParallelism: rewrap.kdfParallelism!,
      encryptedVaultKeyIv: rewrap.encryptedVaultKeyIv!,
      encryptedVaultKey: rewrap.encryptedVaultKey!,
    };

    return { message: response.message, success: true };
  }

}
