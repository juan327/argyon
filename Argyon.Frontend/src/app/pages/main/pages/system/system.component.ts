import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { PresetLimitSelectComponent } from 'src/app/shared/components/presetLimitSelect/presetLimitSelect.component';
import { InfoTooltipComponent } from 'src/app/shared/components/infoTooltip/infoTooltip.component';
import { AlertService } from 'src/app/shared/services/alert.service';
import { SystemSettingsService } from 'src/app/shared/services/systemSettings.service';
import { CONTENT_LIMIT_CHAR_PRESETS, CONTENT_LIMIT_KB_PRESETS } from 'src/app/shared/constants/contentLimits';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-system',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardModule, DividerModule, InputNumberModule, FieldsetModule, TabsModule, ToggleSwitchModule, ButtonComponent, PresetLimitSelectComponent, InfoTooltipComponent, TranslatePipe],
  templateUrl: './system.component.html'
})

export class SystemComponent {
  private readonly _alertService = inject(AlertService);
  private readonly _systemSettingsService = inject(SystemSettingsService);
  private readonly _translate = inject(TranslateService);

  public readonly charPresets = CONTENT_LIMIT_CHAR_PRESETS;
  public readonly kbPresets = CONTENT_LIMIT_KB_PRESETS;

  public registrationEnabled = signal(true);

  public maxNotesAdministrator = signal<number | null>(null);
  public maxFoldersAdministrator = signal<number | null>(null);
  public maxNotesUser = signal<number | null>(null);
  public maxFoldersUser = signal<number | null>(null);

  public canManageNotesAdministrator = signal(true);
  public canUseTwoFactorAdministrator = signal(true);
  public canManageNotesUser = signal(true);
  public canUseTwoFactorUser = signal(true);

  public maxNoteNameCharsAdministrator = signal<number | null>(null);
  public maxNoteNameCharsUser = signal<number | null>(null);
  public maxNoteDescriptionCharsAdministrator = signal<number | null>(null);
  public maxNoteDescriptionCharsUser = signal<number | null>(null);
  public maxNoteTagsCharsAdministrator = signal<number | null>(null);
  public maxNoteTagsCharsUser = signal<number | null>(null);
  public maxNoteDataKbAdministrator = signal<number | null>(null);
  public maxNoteDataKbUser = signal<number | null>(null);
  public maxAttachmentFileSizeKbAdministrator = signal<number | null>(null);
  public maxAttachmentFileSizeKbUser = signal<number | null>(null);

  async ngOnInit() {
    const {
      registrationEnabled, maxNotesAdministrator, maxFoldersAdministrator, maxNotesUser, maxFoldersUser,
      canManageNotesAdministrator, canUseTwoFactorAdministrator,
      canManageNotesUser, canUseTwoFactorUser,
      maxNoteNameCharsAdministrator, maxNoteNameCharsUser,
      maxNoteDescriptionCharsAdministrator, maxNoteDescriptionCharsUser,
      maxNoteTagsCharsAdministrator, maxNoteTagsCharsUser,
      maxNoteDataKbAdministrator, maxNoteDataKbUser,
      maxAttachmentFileSizeKbAdministrator, maxAttachmentFileSizeKbUser,
    } = await this._systemSettingsService.Get();
    this.registrationEnabled.set(registrationEnabled);
    this.maxNotesAdministrator.set(maxNotesAdministrator);
    this.maxFoldersAdministrator.set(maxFoldersAdministrator);
    this.maxNotesUser.set(maxNotesUser);
    this.maxFoldersUser.set(maxFoldersUser);
    this.canManageNotesAdministrator.set(canManageNotesAdministrator);
    this.canUseTwoFactorAdministrator.set(canUseTwoFactorAdministrator);
    this.canManageNotesUser.set(canManageNotesUser);
    this.canUseTwoFactorUser.set(canUseTwoFactorUser);
    this.maxNoteNameCharsAdministrator.set(maxNoteNameCharsAdministrator);
    this.maxNoteNameCharsUser.set(maxNoteNameCharsUser);
    this.maxNoteDescriptionCharsAdministrator.set(maxNoteDescriptionCharsAdministrator);
    this.maxNoteDescriptionCharsUser.set(maxNoteDescriptionCharsUser);
    this.maxNoteTagsCharsAdministrator.set(maxNoteTagsCharsAdministrator);
    this.maxNoteTagsCharsUser.set(maxNoteTagsCharsUser);
    this.maxNoteDataKbAdministrator.set(maxNoteDataKbAdministrator);
    this.maxNoteDataKbUser.set(maxNoteDataKbUser);
    this.maxAttachmentFileSizeKbAdministrator.set(maxAttachmentFileSizeKbAdministrator);
    this.maxAttachmentFileSizeKbUser.set(maxAttachmentFileSizeKbUser);
  }

  public async onToggleRegistrationEnabled(enabled: boolean): Promise<void> {
    this.registrationEnabled.set(enabled);
    this._alertService.showLoading(this._translate.instant('system.savingConfig'));
    const { message, success } = await this._systemSettingsService.SetRegistrationEnabled({ enabled });
    this._alertService.hideLoading();

    if (success === false) {
      this.registrationEnabled.set(!enabled);
      this._alertService.showError(message);
      return;
    }

    this._alertService.showSuccess(message);
  }

  public onToggleUnlimited(field: 'maxNotesAdministrator' | 'maxFoldersAdministrator' | 'maxNotesUser' | 'maxFoldersUser', unlimited: boolean): void {
    this[field].set(unlimited ? null : 0);
  }

  public async onSaveLimits(): Promise<void> {
    this._alertService.showLoading(this._translate.instant('system.savingLimits'));
    const { message, success } = await this._systemSettingsService.SetLimits({
      maxNotesAdministrator: this.maxNotesAdministrator(),
      maxFoldersAdministrator: this.maxFoldersAdministrator(),
      maxNotesUser: this.maxNotesUser(),
      maxFoldersUser: this.maxFoldersUser(),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this._alertService.showSuccess(message);
  }

  public async onSaveContentLimits(): Promise<void> {
    this._alertService.showLoading(this._translate.instant('system.savingContentLimits'));
    const { message, success } = await this._systemSettingsService.SetContentLimits({
      maxNoteNameCharsAdministrator: this.maxNoteNameCharsAdministrator(),
      maxNoteNameCharsUser: this.maxNoteNameCharsUser(),
      maxNoteDescriptionCharsAdministrator: this.maxNoteDescriptionCharsAdministrator(),
      maxNoteDescriptionCharsUser: this.maxNoteDescriptionCharsUser(),
      maxNoteTagsCharsAdministrator: this.maxNoteTagsCharsAdministrator(),
      maxNoteTagsCharsUser: this.maxNoteTagsCharsUser(),
      maxNoteDataKbAdministrator: this.maxNoteDataKbAdministrator(),
      maxNoteDataKbUser: this.maxNoteDataKbUser(),
      maxAttachmentFileSizeKbAdministrator: this.maxAttachmentFileSizeKbAdministrator(),
      maxAttachmentFileSizeKbUser: this.maxAttachmentFileSizeKbUser(),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this._alertService.showSuccess(message);
  }

  public async onSavePermissions(): Promise<void> {
    this._alertService.showLoading(this._translate.instant('system.savingPermissions'));
    const { message, success } = await this._systemSettingsService.SetPermissions({
      canManageNotesAdministrator: this.canManageNotesAdministrator(),
      canUseTwoFactorAdministrator: this.canUseTwoFactorAdministrator(),
      canManageNotesUser: this.canManageNotesUser(),
      canUseTwoFactorUser: this.canUseTwoFactorUser(),
    });
    this._alertService.hideLoading();

    if (success === false) {
      this._alertService.showError(message);
      return;
    }

    this._alertService.showSuccess(message);
  }
}
