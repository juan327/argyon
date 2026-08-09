import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength, required } from '@angular/forms/signals';
import { UnlockService } from './unlock.service';
import { InputTextComponent } from 'src/app/shared/components/inputText/inputText.component';
import { InputPasswordComponent } from 'src/app/shared/components/inputPassword/inputPassword.component';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CardModule } from 'primeng/card';
import { DividerModule } from "primeng/divider";
import { AlertService } from 'src/app/shared/services/alert.service';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'partial-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, InputTextComponent, InputPasswordComponent, ButtonComponent, CardModule, DividerModule, TranslatePipe],
  templateUrl: './unlock.component.html',
})

export class UnlockComponent {
  public readonly thisService = inject(UnlockService);
  private readonly _alertService = inject(AlertService);
  private readonly _databaseService = inject(DatabaseService);
  private readonly _translate = inject(TranslateService);

  public unlockForm = signal({
    password: '',
  });

  public unlockSignal = form(this.unlockForm, (path) => {
    required(path.password),
      minLength(path.password, 4)
  });

  public async OnSubmit(e: SubmitEvent) {
    e.preventDefault();

    const model = this.unlockForm();
    this._alertService.showLoading(this._translate.instant('unlock.validatingPassword'));

    const { message, success } = await this.thisService.ValidatePassword(model.password);

    this._alertService.hideLoading();
    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    await this._databaseService.StartBuild();
  }

}
