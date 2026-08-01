import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOTotp } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { HttpService } from "src/app/shared/services/http.service";
import { VMTotp } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class TwoFactorService {

  private readonly httpService = inject(HttpService);
  private readonly authService = inject(AuthService);

  public async Status(): Promise<{ isEnabled: boolean }> {
    const { response, success } = await this.httpService.Get<DTOGeneric.DTOResponseApiData<boolean>>('Totp/Status');
    if (success === false) {
      return { isEnabled: false };
    }
    return { isEnabled: response.data };
  }

  // password is only required when replacing an already-active 2FA secret (see TotpService.Setup);
  // an empty password skips deriving anything, matching the "no password required yet" case.
  public async Setup(username: string, password: string): Promise<{ message: string, success: boolean, secret?: string, uri?: string }> {
    let authHash: string | undefined;
    if (password !== '') {
      const material = await this.authService.DeriveAuthHashForUser(username, password);
      if (material.success === false) {
        return { message: material.message, success: false };
      }
      authHash = material.authHash;
    }

    const model: VMTotp.VMSetup = { authHash: authHash ?? '' };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOTotp.DTOSetup>>('Totp/Setup', model);
    if (success === false) {
      return { message: response.message, success: false };
    }
    return { message: response.message, success: true, secret: response.data.secret, uri: response.data.uri };
  }

  public async Enable(username: string, password: string, code: string): Promise<{ message: string, success: boolean, recoveryCodes?: string[] }> {
    const material = await this.authService.DeriveAuthHashForUser(username, password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const model: VMTotp.VMEnable = { authHash: material.authHash!, code };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>>('Totp/Enable', model);
    if (success === false) {
      return { message: response.message, success: false };
    }
    return { message: response.message, success: true, recoveryCodes: response.data.recoveryCodes };
  }

  public async Disable(username: string, password: string, code: string): Promise<{ message: string, success: boolean }> {
    const material = await this.authService.DeriveAuthHashForUser(username, password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const model: VMTotp.VMDisable = { authHash: material.authHash!, code };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApi>('Totp/Disable', model);
    return { message: response.message, success };
  }

  public async RegenerateRecoveryCodes(username: string, password: string, code: string): Promise<{ message: string, success: boolean, recoveryCodes?: string[] }> {
    const material = await this.authService.DeriveAuthHashForUser(username, password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const model: VMTotp.VMRegenerateRecoveryCodes = { authHash: material.authHash!, code };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOTotp.DTOEnable>>('Totp/RegenerateRecoveryCodes', model);
    if (success === false) {
      return { message: response.message, success: false };
    }
    return { message: response.message, success: true, recoveryCodes: response.data.recoveryCodes };
  }

}
