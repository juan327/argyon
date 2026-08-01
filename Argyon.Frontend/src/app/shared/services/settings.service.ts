import { computed, inject, Injectable, signal } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { LocalStorageService } from "./localStorage.service";

export interface AppSettings {
    language: 'es' | 'en';
    timezone: string;
    dateFormat: string;
    monthYearFormat: string;
}

/**
 * Converts an Angular DatePipe-style token string (yyyy/MM/dd) into PrimeNG's
 * p-datepicker token syntax (yy/mm/dd), preserving the separator.
 */
export function toPrimeNgDateFormat(angularFormat: string): string {
    return angularFormat.replace(/yyyy/g, 'yy').replace(/MM/g, 'mm');
}

function getDefaultLanguage(): 'es' | 'en' {
    try {
        const browserLanguage = navigator.language ?? navigator.languages?.[0];
        return browserLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
    } catch {
        return 'en';
    }
}

/**
 * Reads the saved language preference directly from localStorage, bypassing
 * LocalStorageService/DI since this runs at module scope in app.config.ts
 * before the injector exists. Falls back to browser detection (and from
 * there to English) on any failure — corrupted JSON, storage access denied, etc.
 */
export function getInitialLanguage(): 'es' | 'en' {
    try {
        const raw = localStorage.getItem('app_settings');
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<AppSettings>;
            if (parsed.language === 'es' || parsed.language === 'en') {
                return parsed.language;
            }
        }
    } catch {
        // ignore and fall through to browser detection
    }
    return getDefaultLanguage();
}

function getDefaultTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
        return 'UTC';
    }
}

const DEFAULT_SETTINGS: AppSettings = {
    language: getDefaultLanguage(),
    timezone: getDefaultTimezone(),
    dateFormat: 'yyyy-MM-dd',
    monthYearFormat: 'yyyy-MM',
};

@Injectable({ providedIn: 'root' })

export class SettingsService {
    private readonly localStorage = inject(LocalStorageService);
    private readonly translate = inject(TranslateService);

    public readonly languageOptions = [
        { label: 'Español', value: 'es' },
        { label: 'English', value: 'en' },
    ];

    public readonly timezoneOptions = Intl.supportedValuesOf('timeZone')
        .map((timezone) => ({ label: timezone, value: timezone }))
        .sort((a, b) => a.label.localeCompare(b.label));

    public readonly dateFormatOptions = [
        { label: 'yyyy-MM-dd', value: 'yyyy-MM-dd' },
        { label: 'dd/MM/yyyy', value: 'dd/MM/yyyy' },
        { label: 'MM/dd/yyyy', value: 'MM/dd/yyyy' },
        { label: 'dd-MM-yyyy', value: 'dd-MM-yyyy' },
        { label: 'dd.MM.yyyy', value: 'dd.MM.yyyy' },
    ];

    public readonly monthYearFormatOptions = [
        { label: 'yyyy-MM', value: 'yyyy-MM' },
        { label: 'MM/yyyy', value: 'MM/yyyy' },
        { label: 'yyyy/MM', value: 'yyyy/MM' },
    ];

    public settings = signal<AppSettings>(this.loadSettings());

    // Combines the configurable date format with the fixed time format for the Angular `date` pipe.
    public readonly dateTimeFormat = computed(() => `${this.settings().dateFormat} hh:mm a`);

    public readonly primeNgDateFormat = computed(() => toPrimeNgDateFormat(this.settings().dateFormat));
    public readonly primeNgMonthYearFormat = computed(() => toPrimeNgDateFormat(this.settings().monthYearFormat));

    private loadSettings(): AppSettings {
        const stored = this.localStorage.GetItem<AppSettings>('app_settings');
        return { ...DEFAULT_SETTINGS, ...stored };
    }

    public Save(settings: AppSettings): void {
        this.settings.set(settings);
        this.localStorage.SetItem('app_settings', settings);
        this.translate.use(settings.language);
    }

}
