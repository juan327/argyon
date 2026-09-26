import { inject, Injectable, signal } from "@angular/core";
import { DTOGeneric, DTOUser } from "src/app/shared/dto";
import { AuthService } from "src/app/shared/services/auth.service";
import { HttpService } from "src/app/shared/services/http.service";
import { LocalStorageService } from "src/app/shared/services/localStorage.service";
import { OfflineStorageService } from "src/app/shared/services/offlineStorage.service";
import { TranslateService } from "@ngx-translate/core";
import { VMUser } from "src/app/shared/vm";

@Injectable({ providedIn: 'any' })

export class UnlockService {
  private readonly localStorage = inject(LocalStorageService);
  private readonly authService = inject(AuthService);
  private readonly httpService = inject(HttpService);
  private readonly offlineStorage = inject(OfflineStorageService);
  private readonly translate = inject(TranslateService);
  public username = signal<string>('');

  constructor() {
    const storedUsername = this.localStorage.GetItem<string>('user_username');

    if (storedUsername) {
      this.username.set(storedUsername);
    }
  }

  public async ValidatePassword(password: string): Promise<{ message: string, success: boolean, canGoOffline?: boolean }> {
    if (this.offlineStorage.offlineMode()) {
      return this.UnlockFromCache(password);
    }

    const material = await this.authService.DeriveAuthHashForUser(this.username(), password);
    if (material.success === false) {
      return { message: material.message, success: false, ...(await this.CheckOfflineFallback()) };
    }

    const request: VMUser.VMValidatePassword = { authHash: material.authHash! };
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('User/ValidatePassword', request);
    if (success === false) {
      return { message: response.message, success: false, ...(await this.CheckOfflineFallback()) };
    }

    const unlockResponse = await this.authService.ActivateVaultKeyFromKek(material.kek!, response.data);
    if (unlockResponse.success === false) {
      return { message: unlockResponse.message, success: false };
    }

    return { message: response.message, success: true };
  }

  // Fully local: unwraps the Vault Key from the cached wrap info with no server round trip.
  private UnlockFromCache(password: string): Promise<{ message: string, success: boolean }> {
    const meta = this.offlineStorage.MetaFor(this.username());
    if (meta === null) {
      return Promise.resolve({ message: this.translate.instant('offline.noSnapshotError'), success: false });
    }
    return this.authService.UnlockVault(password, meta.vaultKeyInfo);
  }

  // Called when a network call above fails: tells the component whether it's worth offering to
  // switch to offline mode (there's local meta for this account - needed because Lock() clears
  // the in-memory wrap info - and the server genuinely looks unreachable), rather than just
  // showing a plain "incorrect password" style error.
  private async CheckOfflineFallback(): Promise<{ canGoOffline: boolean }> {
    if (this.offlineStorage.MetaFor(this.username()) === null) {
      return { canGoOffline: false };
    }
    const connection = await this.httpService.CheckConnection();
    return { canGoOffline: connection === 'offline' };
  }

}
