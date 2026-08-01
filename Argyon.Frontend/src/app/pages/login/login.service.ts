import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { HttpService } from "src/app/shared/services/http.service";
import { VMUser } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class LoginService {

  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);

  public async Login(model: { username: string, password: string }): Promise<{ message: string, success: boolean, requiresTwoFactor?: boolean, pendingToken?: string, kek?: CryptoKey }> {
    const material = await this.authService.DeriveAuthHashForUser(model.username, model.password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const request: VMUser.VMLogin = { username: model.username, authHash: material.authHash! };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOLoginResponse>>('User/Login', request);
    if (success === false) {
      return { message: response.message, success: false };
    }

    if (response.data.requiresTwoFactor) {
      return {
        message: response.message,
        success: true,
        requiresTwoFactor: true,
        pendingToken: response.data.pendingToken ?? '',
        kek: material.kek,
      };
    }

    const unlockResponse = await this.authService.ActivateVaultKeyFromKek(material.kek!, response.data.vaultKeyInfo!);
    if (unlockResponse.success === false) {
      return { message: unlockResponse.message, success: false };
    }
    return { message: response.message, success: true };
  }

  public async VerifyTwoFactor(pendingToken: string, code: string, kek: CryptoKey): Promise<{ message: string, success: boolean }> {
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('Totp/VerifyLogin', { pendingToken, code });
    if (success === false) {
      return { message: response.message, success: false };
    }

    const unlockResponse = await this.authService.ActivateVaultKeyFromKek(kek, response.data);
    if (unlockResponse.success === false) {
      return { message: unlockResponse.message, success: false };
    }
    return { message: response.message, success: true };
  }

  public async Register(model: { username: string, password: string, passwordConfirmation: string }): Promise<{ message: string, success: boolean }> {
    const vault = await this.authService.CreateVault(model.password);
    if (vault.success === false) {
      return { message: vault.message, success: false };
    }

    const request: VMUser.VMRegister = {
      username: model.username,
      authHash: vault.authHash!,
      salt: vault.salt!,
      kdfAlgorithm: vault.kdfAlgorithm!,
      kdfMemory: vault.kdfMemory!,
      kdfIterations: vault.kdfIterations!,
      kdfParallelism: vault.kdfParallelism!,
      encryptedVaultKeyIv: vault.encryptedVaultKeyIv!,
      encryptedVaultKey: vault.encryptedVaultKey!,
    };

    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApi>('User/Register', request);
    if (success === false) {
      return { message: response.message, success: false };
    }

    await this.authService.ActivateVaultKey(vault.vaultKeyRaw!, {
      salt: vault.salt!,
      kdfAlgorithm: vault.kdfAlgorithm!,
      kdfMemory: vault.kdfMemory!,
      kdfIterations: vault.kdfIterations!,
      kdfParallelism: vault.kdfParallelism!,
      encryptedVaultKeyIv: vault.encryptedVaultKeyIv!,
      encryptedVaultKey: vault.encryptedVaultKey!,
    });
    return { message: response.message, success };
  }

  public async Ping(): Promise<boolean> {
    return await this.httpService.Ping(false);
  }

}
