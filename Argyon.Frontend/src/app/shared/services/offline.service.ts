import { inject, Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "./auth.service";
import { AlertService } from "./alert.service";
import { DatabaseService } from "./database.service";
import { HttpService } from "./http.service";
import { OfflineStorageService } from "./offlineStorage.service";
import { TokenRefreshService } from "./tokenRefresh.service";
import { DTOGeneric, DTOUser } from "../dto";
import { VMUser } from "../vm";

/**
 * Orchestrates entering/leaving offline mode. Kept separate from OfflineStorageService (which
 * only owns the flag/IndexedDB access and has no dependency on AuthService/DatabaseService) so
 * that DatabaseService can read the offline flag directly without a circular dependency: this
 * service depends on DatabaseService, not the other way around.
 */
@Injectable({ providedIn: 'root' })

export class OfflineService {
  private readonly _authService = inject(AuthService);
  private readonly _databaseService = inject(DatabaseService);
  private readonly _offlineStorage = inject(OfflineStorageService);
  private readonly _tokenRefreshService = inject(TokenRefreshService);
  private readonly _httpService = inject(HttpService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);

  // Add/edit/delete stay visible and clickable while offline, but actually saving needs the
  // server. Callers check this right before the point where they would call the API (not when
  // merely opening a modal/dialog that doesn't itself save anything) and skip the call if it
  // returns true, showing this notice - which offers a quick way to reconnect - instead.
  public NotifyOfflineAction(): boolean {
    if (this._offlineStorage.offlineMode() === false) return false;

    this._alertService.showConfirmation({
      title: this._translate.instant('offline.actionBlockedTitle'),
      message: this._translate.instant('offline.actionBlockedMessage'),
      icon: 'pi pi-wifi',
      acceptLabel: this._translate.instant('offline.goOnlineButton'),
      acceptSeverity: 'warn',
      accept: () => {
        this.DisableOffline();
      },
    });
    return true;
  }

  // Requires re-proving the master password against the server: activating offline mode is a
  // deliberate, security-relevant choice (it disables the token refresh/vault-freshness checks
  // that normally guard the session), so it gets the same confirmation bar as other sensitive
  // actions (delete, export, change password) rather than being a plain toggle.
  public async EnableOffline(password: string): Promise<{ message: string, success: boolean }> {
    const username = this._authService.currentUser()?.username ?? '';
    const material = await this._authService.DeriveAuthHashForUser(username, password);
    if (material.success === false) {
      return { message: material.message, success: false };
    }

    const request: VMUser.VMValidatePassword = { authHash: material.authHash! };
    const { response, success } = await this._httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTOVaultKeyInfo>>('User/ValidatePassword', request);
    if (success === false) {
      return { message: response.message, success: false };
    }

    const me = this._authService.currentUser();
    if (me !== null) {
      await this._offlineStorage.EnsureMeta(me, response.data);
    }
    this._offlineStorage.SetOfflineMode(true);
    this._tokenRefreshService.stop();
    await this._databaseService.LoadFromCache();
    return { message: response.message, success: true };
  }

  public async DisableOffline(): Promise<{ message: string, success: boolean }> {
    this._offlineStorage.SetOfflineMode(false);
    this._tokenRefreshService.start(this._authService.currentUser()?.accessTokenExpiryMinutes ?? 15);
    return this._databaseService.StartBuild();
  }

  public async ClearLocalData(): Promise<void> {
    await this._offlineStorage.Clear();
    this._offlineStorage.SetOfflineMode(false);
  }

  // Logging out while offline can't reach User/Logout to revoke the server-side session, so it
  // is only done locally - the caller (nav.component.ts) is responsible for warning the user
  // beforehand that a real login (which needs connectivity) will be required afterwards.
  public async LogoutOffline(): Promise<void> {
    this._databaseService.CloseStream();
    this._tokenRefreshService.stop();
    this._authService.currentUser.set(null);
    this._authService.Lock();
    await this.ClearLocalData();
  }
}
