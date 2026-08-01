import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { HttpService } from "src/app/shared/services/http.service";
import { LocalStorageService } from "src/app/shared/services/localStorage.service";
import { VMUser } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class UnlockService {
  private readonly localStorage = inject(LocalStorageService);
  private readonly authService = inject(AuthService);
  private readonly httpService = inject(HttpService);
  public username = signal<string>('');

  constructor() {
    const storedUsername = this.localStorage.GetItem<string>('user_username');

    if (storedUsername) {
      this.username.set(storedUsername);
    }
  }

  public async ValidatePassword(password: string): Promise<{message: string, success: boolean}> {
    const material = await this.authService.DeriveAuthHashForUser(this.username(), password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const request: VMUser.VMValidatePassword = { authHash: material.authHash! };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('User/ValidatePassword', request);
    if (success === false) {
      return { message: response.message, success: false };
    }

    const unlockResponse = await this.authService.ActivateVaultKeyFromKek(material.kek!, response.data);
    if (unlockResponse.success === false) {
      return { message: unlockResponse.message, success: false };
    }

    return { message: response.message, success: true };
  }

}
