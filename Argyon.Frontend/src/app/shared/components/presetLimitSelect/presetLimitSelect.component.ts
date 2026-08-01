import { Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TranslateService } from '@ngx-translate/core';

type PresetMode = 'inherit' | 'unlimited' | 'small' | 'medium' | 'large' | 'custom';

// The `value` model IS the wire format used by both the role-level (Sistema) and per-user
// (Usuarios) endpoints: null = unlimited (or, when showInherit is true, "inherit from role"),
// -1 = explicit unlimited override (only meaningful when showInherit is true), >=1 = a cap.
@Component({
    selector: 'component-presetLimitSelect',
    imports: [FormsModule, SelectModule, InputNumberModule],
    templateUrl: './presetLimitSelect.component.html'
})

export class PresetLimitSelectComponent {
    private readonly _translate = inject(TranslateService);

    value = model<number | null>(null);
    presets = input.required<{ small: number; medium: number; large: number }>();
    showInherit = input<boolean>(false);
    unit = input<'chars' | 'kb'>('chars');

    public readonly mode = computed<PresetMode>(() => {
        const value = this.value();
        const presets = this.presets();
        if (this.showInherit() && value === null) return 'inherit';
        if (this.showInherit() === false && value === null) return 'unlimited';
        if (this.showInherit() && value === -1) return 'unlimited';
        if (value === presets.small) return 'small';
        if (value === presets.medium) return 'medium';
        if (value === presets.large) return 'large';
        return 'custom';
    });

    public readonly modeOptions = computed(() => {
        this._translate.currentLang();
        const presets = this.presets();
        const unitSuffix = this.unit() === 'kb' ? this._translate.instant('presetLimitSelect.unitKb') : this._translate.instant('presetLimitSelect.unitChars');

        const options: { label: string; value: PresetMode }[] = [];
        if (this.showInherit()) {
            options.push({ label: this._translate.instant('presetLimitSelect.inherit'), value: 'inherit' });
        }
        options.push({ label: this._translate.instant('presetLimitSelect.unlimited'), value: 'unlimited' });
        options.push({ label: `${this._translate.instant('presetLimitSelect.small')} (${presets.small} ${unitSuffix})`, value: 'small' });
        options.push({ label: `${this._translate.instant('presetLimitSelect.medium')} (${presets.medium} ${unitSuffix})`, value: 'medium' });
        options.push({ label: `${this._translate.instant('presetLimitSelect.large')} (${presets.large} ${unitSuffix})`, value: 'large' });
        options.push({ label: this._translate.instant('presetLimitSelect.custom'), value: 'custom' });
        return options;
    });

    public onModeChange(mode: PresetMode): void {
        const presets = this.presets();
        switch (mode) {
            case 'inherit': this.value.set(null); break;
            case 'unlimited': this.value.set(this.showInherit() ? -1 : null); break;
            case 'small': this.value.set(presets.small); break;
            case 'medium': this.value.set(presets.medium); break;
            case 'large': this.value.set(presets.large); break;
            case 'custom': this.value.set(this.value() !== null && this.value()! > 0 ? this.value() : 1); break;
        }
    }

    public onCustomValueChange(value: number): void {
        this.value.set(value > 0 ? value : 1);
    }
}
