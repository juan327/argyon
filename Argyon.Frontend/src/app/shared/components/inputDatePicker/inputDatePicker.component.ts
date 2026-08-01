import { Component, computed, inject, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { getDateFieldConfig } from 'src/app/shared/entities/note';
import { SettingsService } from 'src/app/shared/services/settings.service';

@Component({
    selector: 'component-inputDatePicker',
    imports: [DatePickerModule, FormsModule, InputGroupModule, InputGroupAddonModule, ButtonModule, IftaLabelModule],
    templateUrl: './inputDatePicker.component.html'
})

export class InputDatePickerComponent {
    private readonly _settingsService = inject(SettingsService);

    public dateDay = input<boolean>(true);
    public dateMonth = input<boolean>(true);
    public dateYear = input<boolean>(true);
    public dateHour = input<boolean>(false);
    public placeholder = input<string>('');
    public label = input<string>('');
    public disabled = input<boolean>(false);
    public showCopyButton = input<boolean>(false);

    public onCopy = output<void>();

    public value = model<string>('');

    public config = computed(() => getDateFieldConfig(
        this.dateDay(), this.dateMonth(), this.dateYear(), this.dateHour(),
        this._settingsService.primeNgDateFormat(), this._settingsService.primeNgMonthYearFormat()
    ));

    private _cachedRaw: string | null = null;
    private _cachedDate: Date | null = null;

    public get date(): Date | null {
        const raw = this.value();
        if (raw === this._cachedRaw) return this._cachedDate;

        this._cachedRaw = raw;
        if (!raw) {
            this._cachedDate = null;
        } else {
            const parsed = new Date(raw);
            this._cachedDate = isNaN(parsed.getTime()) ? null : parsed;
        }
        return this._cachedDate;
    }

    public set date(value: Date | null) {
        this.value.set(value ? value.toISOString() : '');
    }
}
