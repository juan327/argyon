import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { UnlockService } from './unlock.service';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CardModule } from 'primeng/card';
import { DividerModule } from "primeng/divider";
import { MessageModule } from 'primeng/message';
import { AlertService } from 'src/app/shared/services/alert.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { OfflineStorageService } from 'src/app/shared/services/offlineStorage.service';
import { TokenRefreshService } from 'src/app/shared/services/tokenRefresh.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'partial-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, InputTextComponent, InputPasswordComponent, ButtonComponent, CardModule, DividerModule, MessageModule, TranslatePipe],
  templateUrl: './unlock.component.html',
})

export class UnlockComponent {
  public readonly thisService = inject(UnlockService);
  private readonly _alertService = inject(AlertService);
  private readonly _databaseService = inject(DatabaseService);
  private readonly _offlineStorage = inject(OfflineStorageService);
  private readonly _tokenRefreshService = inject(TokenRefreshService);
  private readonly _translate = inject(TranslateService);

  public unlockForm = signal({
    password: '',
  });

  public unlockSignal = form(this.unlockForm, (path) => {
    required(path.password, { message: this._translate.instant('common.passwordRequired') }),
      minLength(path.password, 4, { message: this._translate.instant('common.passwordMinLength', { min: 4 }) })
  });

  public async OnSubmit(e: SubmitEvent) {
    e.preventDefault();

    const model = this.unlockForm();
    this._alertService.showLoading(this._translate.instant('unlock.validatingPassword'));

    const { message, success, canGoOffline } = await this.thisService.ValidatePassword(model.password);

    this._alertService.hideLoading();
    if (success === false) {
      if (canGoOffline) {
        this.offerOfflineSwitch(model.password);
        return;
      }
      this._alertService.showError(message);
      return;
    }

    await this._databaseService.StartBuild();
  }

  // The server looks unreachable but there's a usable local snapshot for this account: offer to
  // switch to offline mode and, if accepted, retry the same password fully locally.
  private offerOfflineSwitch(password: string): void {
    this._alertService.showConfirmation({
      title: this._translate.instant('offline.switchDialogTitle'),
      message: this._translate.instant('offline.switchDialogMessage'),
      icon: 'pi pi-wifi',
      acceptLabel: this._translate.instant('offline.switchDialogAccept'),
      acceptSeverity: 'warn',
      accept: async () => {
        this._offlineStorage.SetOfflineMode(true);
        this._tokenRefreshService.stop();

        const retry = await this.thisService.ValidatePassword(password);
        if (retry.success === false) {
          this._alertService.showError(retry.message);
          return;
        }
        await this._databaseService.StartBuild();
      },
    });
  }

}
