import { CommonModule, JsonPipe } from '@angular/common';
import { Component, computed, ContentChild, effect, inject, input, InputSignal, model, OnInit, output, signal, TemplateRef, untracked, WritableSignal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { KeyFilterModule } from 'primeng/keyfilter';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { GeneratePasswordService } from './generatePassword.service';
import { form, FormField, max, min, minLength, required } from '@angular/forms/signals';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { AlertService } from 'src/app/shared/services/alert.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LocalStorageService } from 'src/app/shared/services/localStorage.service';

interface GeneratePasswordSettings {
    length: number;
    prioritizeSpecialChars: boolean;
    activeButtonIds: number[];
}

@Component({
    selector: 'component-generatePassword',
    imports: [FormsModule, FormField, CommonModule, DialogModule, InputGroupModule, InputGroupAddonModule, ButtonModule, KeyFilterModule, ToggleButtonModule, InputTextModule, DividerModule, InputNumberModule, CheckboxModule, MessageModule, ProgressBarModule, TranslatePipe],
    templateUrl: './generatePassword.component.html',
    styleUrls: ['./generatePassword.component.css']
})

export class GeneratePasswordComponent implements OnInit {
    private readonly _thisService = inject(GeneratePasswordService);
    private readonly _alertService = inject(AlertService);
    private readonly _translate = inject(TranslateService);
    private readonly _localStorageService = inject(LocalStorageService);
    public readonly _minPasswordLength = 1;
    public readonly _maxPasswordLength = 200;

    public open = output<boolean>();
    public onApplyPassword = output<string>();

    public _type = signal<string>('password');
    public _icon = computed(() => this._type() === 'password' ? 'pi pi-eye' : 'pi pi-eye-slash');

    public _blockSpace: RegExp = /^[^\s]+$/;

    private _storedSettings = this._localStorageService.GetItem<GeneratePasswordSettings>('generate_password_settings');

    public _buttonCharacters = signal(
        this._thisService.getButtonCharacters().map(button => this._storedSettings
            ? { ...button, active: this._storedSettings.activeButtonIds.includes(button.id) }
            : button)
    );

    public _passwordScore = computed(() => {
        const passwordStrength = this._thisService.calculatePasswordScore(this._mainModel().password);
        return { label: passwordStrength.label, value: passwordStrength.score };
    });

    public _mainModel = signal<{ password: string }>({
        password: '',
    });

    public _optionsModel = signal({
        length: this._storedSettings?.length ?? 24,
        pattern: this._thisService.getPattern(this._buttonCharacters()),
        prioritizeSpecialChars: this._storedSettings?.prioritizeSpecialChars ?? false,
    });

    public _mainForm = form(this._mainModel, (path) => {
        required(path.password, { message: this._translate.instant('generatePassword.passwordRequired') })
    });

    public _optionsForm = form(this._optionsModel, (path) => {
        required(path.pattern, { message: this._translate.instant('generatePassword.charsetRequired') }),
        required(path.length, { message: this._translate.instant('generatePassword.lengthRequired') }),
        min(path.length, this._minPasswordLength, { message: this._translate.instant('generatePassword.lengthMin', { min: this._minPasswordLength }) });
        max(path.length, this._maxPasswordLength, { message: this._translate.instant('generatePassword.lengthMax', { max: this._maxPasswordLength }) });
    });
    constructor() {
        if (!this._storedSettings) {
            this.toggleActiveButtonCharacter(1);
        }
        effect(() => {
            this.refreshPassword();
        });
        effect(() => {
            this.saveSettings();
        });
    }

    async ngOnInit() {
    }

    public onVisibleChange(event: boolean) {
        this.open.emit(event);
    }

    public copyPassword() {
        const value = this._mainModel().password;
        if (value) {
            navigator.clipboard.writeText(value);
            this._alertService.showAlert('info', this._translate.instant('generatePassword.passwordCopiedTitle'), this._translate.instant('generatePassword.passwordCopiedMessage'));
        }
    }

    public togglePasswordVisibility() {
        this._type.set(this._type() === 'password' ? 'text' : 'password');
    }

    public onSubmit(e: SubmitEvent) {
        e.preventDefault();
    }

    public refreshPassword() {
        if (this._optionsForm().invalid()) {
            return;
        }
        const formValue = this._optionsModel();
        const newPassword = this._thisService.generatePassword(formValue.length, formValue.pattern);
        untracked(() => {
            this._mainModel.update(model => ({ ...model, password: newPassword }));
        });
    }

    private saveSettings() {
        const options = this._optionsModel();
        const activeButtonIds = this._buttonCharacters().filter(button => button.active).map(button => button.id);
        this._localStorageService.SetItem('generate_password_settings', {
            length: options.length,
            prioritizeSpecialChars: options.prioritizeSpecialChars,
            activeButtonIds,
        } satisfies GeneratePasswordSettings);
    }

    public toggleActiveButtonCharacter(id: number) {
        this._buttonCharacters.update(buttons => {
            return buttons.map(button => {
                if (button.id === id) {
                    return { ...button, active: !button.active };
                }
                return button;
            });
        });
        const newPattern = this._thisService.getPattern(this._buttonCharacters());
        this._optionsModel.update(model => ({ ...model, pattern: newPattern }));
    }

    public changePasswordLength(length: number | null) {
        if (length === null) return;
        this._optionsModel.update(model => ({ ...model, length }));
    }

    public changePrioritizeSpecialChars(value: boolean) {
        this._optionsModel.update(model => ({ ...model, prioritizeSpecialChars: value }));
    }

    public applyPassword(e: SubmitEvent | null = null) {
        if (e) {
            e.preventDefault();
        }
        const password = this._mainModel().password;
        if (password) {
            this.onApplyPassword.emit(password);
            this.onVisibleChange(false);
            this._alertService.showAlert('success', this._translate.instant('generatePassword.passwordAppliedTitle'), this._translate.instant('generatePassword.passwordAppliedMessage'));
        }
    }
}
