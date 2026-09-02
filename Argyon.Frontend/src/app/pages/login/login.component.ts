import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginService } from './login.service';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { LocalStorageService } from 'src/app/shared/services/localStorage.service';
import { CardModule } from "primeng/card";
import { DividerModule } from "primeng/divider";
import { InputOtpModule } from "primeng/inputotp";
import { MessageModule } from "primeng/message";
import { AlertService } from 'src/app/shared/services/alert.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { SystemSettingsService } from 'src/app/shared/services/systemSettings.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { JsonPipe } from '@angular/common';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, InputTextComponent, InputPasswordComponent, ButtonComponent, CardModule, DividerModule, InputOtpModule, MessageModule, FormsModule, TranslatePipe, JsonPipe],
  templateUrl: './login.component.html'
})

export class LoginComponent {
  private readonly _thisService = inject(LoginService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _alertService = inject(AlertService);
  private readonly _localStorageService = inject(LocalStorageService);
  private readonly _databaseService = inject(DatabaseService);
  private readonly _systemSettingsService = inject(SystemSettingsService);
  private readonly _translate = inject(TranslateService);

  public mode = signal<Mode>(this._route.snapshot.data['mode'] === 'register' ? 'register' : 'login');
  public registrationEnabled = signal(true);
  public noUsersExist = signal(false);

  // Login form
  public loginForm = signal({
    username: '',
    password: '',
  });

  public loginSignal = form(this.loginForm, (path) => {
    required(path.username, { message: this._translate.instant('common.usernameRequired') }),
      minLength(path.username, 3, { message: this._translate.instant('common.usernameMinLength', { min: 3 }) }),
      required(path.password, { message: this._translate.instant('common.passwordRequired') }),
      minLength(path.password, 4, { message: this._translate.instant('common.passwordMinLength', { min: 4 }) })
  });

  // Second login step: filled in when the server indicates that the user
  // has TOTP enabled. Only the already-derived KEK is kept in memory (not the password
  // itself) to be able to unwrap the Vault Key once the code is validated.
  public pendingTwoFactor = signal<{ pendingToken: string, kek: CryptoKey } | null>(null);
  public twoFactorCode = signal('');
  public useRecoveryCode = signal(false);
  public recoveryCode = signal('');

  // Register form
  public registerForm = signal({
    username: '',
    password: '',
    passwordConfirmation: ''
  });

  public registerSignal = form(this.registerForm, (path) => {
    required(path.username, { message: this._translate.instant('common.usernameRequired') }),
      minLength(path.username, 3, { message: this._translate.instant('common.usernameMinLength', { min: 3 }) }),
      required(path.password, { message: this._translate.instant('common.passwordRequired') }),
      minLength(path.password, 4, { message: this._translate.instant('common.passwordMinLength', { min: 4 }) }),
      required(path.passwordConfirmation, { message: this._translate.instant('common.confirmPasswordRequired') }),
      validate(path.passwordConfirmation, ({ value }) => {
        const password = this.registerForm().password;
        if (value() !== password) {
          return {
            kind: 'passwordMismatch',
            message: this._translate.instant('common.passwordMismatch')
          };
        }
        return null;
      })
  });

  async ngOnInit() {
    const pingResult = await this._thisService.Ping();
    if (pingResult === true) {
      this._router.navigate(['/home']);
      return;
    }

    const { registrationEnabled, hasAnyUser } = await this._systemSettingsService.Get();
    this.registrationEnabled.set(registrationEnabled);
    this.noUsersExist.set(!hasAnyUser);

    if (hasAnyUser === false && this.mode() !== 'register') {
      this._router.navigate(['/register']);
      return;
    }
  }

  public async SubmitLogin(e: SubmitEvent) {
    e.preventDefault();

    const model = this.loginForm();
    this._alertService.showLoading(this._translate.instant('login.loggingIn'));
    const { message, success, requiresTwoFactor, pendingToken, kek } = await this._thisService.Login(model);
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    if (requiresTwoFactor) {
      this.pendingTwoFactor.set({ pendingToken: pendingToken!, kek: kek! });
      return;
    }

    this._localStorageService.SetItem('user_username', model.username);
    this.StartBuildInBackground();
    this._router.navigate(['/home']);
  }

  public async SubmitTwoFactor() {
    const pending = this.pendingTwoFactor();
    if (pending === null) return;

    const code = this.useRecoveryCode() ? this.recoveryCode() : this.twoFactorCode();

    this._alertService.showLoading(this._translate.instant('login.verifyingCode'));
    const { message, success } = await this._thisService.VerifyTwoFactor(pending.pendingToken, code, pending.kek);
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this._localStorageService.SetItem('user_username', this.loginForm().username);
    this.StartBuildInBackground();
    this._router.navigate(['/home']);
  }

  public onCancelTwoFactor() {
    this.pendingTwoFactor.set(null);
    this.twoFactorCode.set('');
    this.recoveryCode.set('');
    this.useRecoveryCode.set(false);
  }

  public onToggleRecoveryCodeMode() {
    this.useRecoveryCode.update(value => !value);
    this.twoFactorCode.set('');
    this.recoveryCode.set('');
  }

  public async SubmitRegister(e: SubmitEvent) {
    e.preventDefault();

    const model = this.registerForm();
    this._alertService.showLoading(this._translate.instant('login.loggingIn'));
    const { message, success } = await this._thisService.Register(model);
    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this._localStorageService.SetItem('user_username', model.username);
    this.StartBuildInBackground();
    this._router.navigate(['/home']);
  }

  public onRedirectToRegister() {
    this._router.navigate(['/register']);
  }

  public onRedirectToLogin() {
    this._router.navigate(['/login']);
  }

  // It does not wait for all the streaming to finish before navigating: /home can already be seen and used
  // with the notes as they arrive (DatabaseService.loadingDatabase governs the loading notice).
  // If it fails, the user is still notified, even though they are already viewing /home.
  private StartBuildInBackground(): void {
    this._databaseService.StartBuild().then(({ success, message }) => {
      if (success === false) {
        this._alertService.showError(message);
      }
    });
  }

}
