import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { form, FormField, minLength, required, validate } from '@angular/forms/signals';
import * as QRCode from 'qrcode';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { InputOtpModule } from 'primeng/inputotp';
import { TabsModule } from 'primeng/tabs';
import { MessageModule } from 'primeng/message';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { AuthService } from 'src/app/shared/services/auth.service';
import { SettingsService } from 'src/app/shared/services/settings.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { OfflineStorageService } from 'src/app/shared/services/offlineStorage.service';
import { OfflineService } from 'src/app/shared/services/offline.service';
import { ChangePasswordService } from './changePassword.service';
import { TwoFactorService } from './twoFactor.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IftaLabelModule } from 'primeng/iftalabel';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, SelectModule, CardModule, DividerModule, TagModule, InputOtpModule, TabsModule, MessageModule, ToggleSwitchModule, ProgressBarModule, ButtonComponent, FormField, InputPasswordComponent, InputTextComponent, DialogComponent, TranslatePipe, IftaLabelModule],
  templateUrl: './settings.component.html'
})

export class SettingsComponent {
  public readonly settingsService = inject(SettingsService);
  public readonly authService = inject(AuthService);
  public readonly offlineStorage = inject(OfflineStorageService);
  private readonly _offlineService = inject(OfflineService);
  private readonly _alertService = inject(AlertService);
  public readonly databaseService = inject(DatabaseService);
  private readonly _changePasswordService = inject(ChangePasswordService);
  private readonly _twoFactorService = inject(TwoFactorService);
  private readonly _translate = inject(TranslateService);

  public twoFactorEnabled = signal(false);

  public setupModalOpen = signal(false);
  public setupPassword = signal('');
  public setupCode = signal('');
  public setupSecret = signal('');
  public setupQrDataUrl = signal<string | null>(null);

  public disableModalOpen = signal(false);
  public disablePassword = signal('');
  public disableCode = signal('');
  public disableUseRecoveryCode = signal(false);

  public recoveryCodesModalOpen = signal(false);
  public recoveryCodes = signal<string[]>([]);

  public enableOfflineModalOpen = signal(false);
  public enableOfflinePassword = signal('');
  public enableOfflineLoading = signal(false);

  public syncModalOpen = signal(false);
  public syncPassword = signal('');

  public language = signal(this.settingsService.settings().language);
  public timezone = signal(this.settingsService.settings().timezone);
  public dateFormat = signal(this.settingsService.settings().dateFormat);
  public monthYearFormat = signal(this.settingsService.settings().monthYearFormat);

  public changePasswordForm = signal({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirmation: ''
  });

  public changePasswordSignal = form(this.changePasswordForm, (path) => {
    required(path.currentPassword, { message: this._translate.instant('settings.currentPasswordRequired') }),
      required(path.newPassword, { message: this._translate.instant('settings.newPasswordRequired') }),
      minLength(path.newPassword, 4, { message: this._translate.instant('common.passwordMinLength', { min: 4 }) }),
      required(path.newPasswordConfirmation, { message: this._translate.instant('settings.confirmNewPasswordRequired') }),
      validate(path.newPasswordConfirmation, ({ value }) => {
        const newPassword = this.changePasswordForm().newPassword;
        if (value() !== newPassword) {
          return {
            kind: 'passwordMismatch',
            message: this._translate.instant('common.passwordMismatch')
          };
        }
        return null;
      })
  });

  public async OnSubmit(e: SubmitEvent) {
    e.preventDefault();
    this._alertService.showLoading(this._translate.instant('settings.savingConfig'));
    this.settingsService.Save({
      language: this.language(),
      timezone: this.timezone(),
      dateFormat: this.dateFormat(),
      monthYearFormat: this.monthYearFormat(),
    });

    await this.databaseService.StartBuild();
    this._alertService.hideLoading();
    this._alertService.showSuccess(this._translate.instant('settings.configSaved'));
  }

  public async OnSubmitChangePassword(e: SubmitEvent) {
    e.preventDefault();

    const model = this.changePasswordForm();
    this._alertService.showLoading(this._translate.instant('settings.updatingPassword'));

    const username = this.authService.currentUser()?.username ?? '';
    const { message, success } = await this._changePasswordService.ChangePassword(username, model);

    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.changePasswordForm.set({
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: ''
    });
    this._alertService.showSuccess(message);
  }

  public onToggleOfflineMode(value: boolean) {
    if (value) {
      this.enableOfflinePassword.set('');
      this.enableOfflineModalOpen.set(true);
      return;
    }

    this._alertService.showConfirmation({
      title: this._translate.instant('offline.disableConfirmTitle'),
      message: this._translate.instant('offline.disableConfirmMessage'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translate.instant('offline.exitButton'),
      acceptSeverity: 'warn',
      accept: async () => {
        await this._offlineService.DisableOffline();
      },
    });
  }

  public async onConfirmEnableOffline() {
    this.enableOfflineLoading.set(true);
    const { message, success } = await this._offlineService.EnableOffline(this.enableOfflinePassword());
    this.enableOfflineLoading.set(false);

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this.enableOfflineModalOpen.set(false);
    this.enableOfflinePassword.set('');
  }

  public onOpenSyncModal() {
    this.syncPassword.set('');
    this.syncModalOpen.set(true);
  }

  public async onConfirmSync() {
    const { message, success } = await this.databaseService.SyncToLocal(this.syncPassword());
    if (success === false) {
      this._alertService.showError(message);
      return;
    }
    this.syncModalOpen.set(false);
    this.syncPassword.set('');
    this._alertService.showSuccess(message);
  }

  async ngOnInit() {
    if (this.authService.canUseTwoFactor()) {
      const status = await this._twoFactorService.Status();
      this.twoFactorEnabled.set(status.isEnabled);
    }
  }

  public onOpenSetupModal() {
    this.setupPassword.set('');
    this.setupCode.set('');
    this.setupSecret.set('');
    this.setupQrDataUrl.set(null);
    this.setupModalOpen.set(true);
  }

  public async onOpenSetupModalDirect() {
    this._alertService.showLoading(this._translate.instant('settings.generatingCode'));
    const result = await this._twoFactorService.Setup(this.authService.currentUser()?.username ?? '', '');
    this._alertService.hideLoading();
    if (result.success === false) {
      this._alertService.showError(result.message);
      return;
    }

    this.setupPassword.set('');
    this.setupCode.set('');
    this.setupSecret.set(result.secret!);
    this.setupQrDataUrl.set(await QRCode.toDataURL(result.uri!));
    this.setupModalOpen.set(true);
  }

  public async onGenerateQrCode() {
    this._alertService.showLoading(this._translate.instant('settings.generatingCode'));
    const result = await this._twoFactorService.Setup(this.authService.currentUser()?.username ?? '', this.setupPassword());
    this._alertService.hideLoading();
    if (result.success === false) {
      this._alertService.showError(result.message);
      return;
    }

    this.setupSecret.set(result.secret!);
    this.setupQrDataUrl.set(await QRCode.toDataURL(result.uri!));
  }

  public async onConfirmEnable() {
    this._alertService.showLoading(this._translate.instant('settings.enabling2fa'));
    const result = await this._twoFactorService.Enable(this.authService.currentUser()?.username ?? '', this.setupPassword(), this.setupCode());
    this._alertService.hideLoading();
    if (result.success === false) {
      this._alertService.showError(result.message);
      return;
    }

    this.setupModalOpen.set(false);
    this.twoFactorEnabled.set(true);
    this.recoveryCodes.set(result.recoveryCodes ?? []);
    this.recoveryCodesModalOpen.set(true);
    this._alertService.showSuccess(result.message);
  }

  public onOpenDisableModal() {
    this.disablePassword.set('');
    this.disableCode.set('');
    this.disableUseRecoveryCode.set(false);
    this.disableModalOpen.set(true);
  }

  public onToggleDisableRecoveryCode() {
    this.disableUseRecoveryCode.update(value => !value);
    this.disableCode.set('');
  }

  public async onConfirmDisable() {
    this._alertService.showLoading(this._translate.instant('settings.disabling2fa'));
    const result = await this._twoFactorService.Disable(this.authService.currentUser()?.username ?? '', this.disablePassword(), this.disableCode());
    this._alertService.hideLoading();
    if (result.success === false) {
      this._alertService.showError(result.message);
      return;
    }

    this.disableModalOpen.set(false);
    this.twoFactorEnabled.set(false);
    this._alertService.showSuccess(result.message);
  }

}
