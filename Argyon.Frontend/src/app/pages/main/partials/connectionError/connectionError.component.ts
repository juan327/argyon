import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { HttpService } from 'src/app/shared/services/http.service';
import { LocalStorageService } from 'src/app/shared/services/localStorage.service';
import { OfflineStorageService } from 'src/app/shared/services/offlineStorage.service';
import { TokenRefreshService } from 'src/app/shared/services/tokenRefresh.service';

// Shown instead of the unlock screen when the server couldn't be reached on load (see AuthGuard):
// lets the user retry, enter offline mode, or go to the login page, rather than being logged out.
@Component({
  selector: 'partial-connection-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardModule, DividerModule, MessageModule, ButtonComponent, TranslatePipe],
  templateUrl: './connectionError.component.html',
})

export class ConnectionErrorComponent {
  private readonly _router = inject(Router);
  private readonly _httpService = inject(HttpService);
  private readonly _authService = inject(AuthService);
  private readonly _alertService = inject(AlertService);
  private readonly _translate = inject(TranslateService);
  private readonly _tokenRefreshService = inject(TokenRefreshService);
  private readonly _offlineStorage = inject(OfflineStorageService);
  private readonly _localStorage = inject(LocalStorageService);

  public retrying = signal(false);
  public canEnterOffline = computed(() => this._offlineStorage.MetaFor(this._localStorage.GetItem<string>('user_username')) !== null);

  public async onRetry() {
    this.retrying.set(true);
    const status = await this._httpService.CheckConnection();
    this.retrying.set(false);

    if (status === 'offline') {
      this._alertService.showWarn(this._translate.instant('offline.stillOffline'));
      return;
    }
    if (status === 'unauthorized') {
      this._offlineStorage.serverUnreachable.set(false);
      this._router.navigate(['/login']);
      return;
    }

    await this._authService.LoadCurrentUser();
    this._offlineStorage.serverUnreachable.set(false);
    this._tokenRefreshService.start(this._authService.currentUser()?.accessTokenExpiryMinutes ?? 15);
  }

  public onEnterOffline() {
    this._offlineStorage.SetOfflineMode(true);
    this._offlineStorage.serverUnreachable.set(false);
  }

  public onGoToLogin() {
    this._offlineStorage.serverUnreachable.set(false);
    this._router.navigate(['/login']);
  }

}
