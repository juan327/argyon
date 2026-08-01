# `Accept-Language` HTTP interceptor in Argyon.Frontend

This document describes how Argyon.Frontend (Angular 22, standalone, signal-based) attaches the `Accept-Language` header to every outgoing HTTP request, so the backend (`Argyon.Backend`) can localize its responses (see `docs/.net/resource_Files_IStringLocalizer.md`). The implementation uses a **functional HTTP interceptor** reading from a signal-based settings service — no `HttpClientModule`/class-based interceptor is used anywhere in this project.

---

## 1. Single source of truth: `SettingsService`

The current language lives in `SettingsService` (`src/app/shared/services/settings.service.ts`), as part of a broader `AppSettings` object that also holds the timezone. It's exposed as a `signal`, following this project's convention of using signals instead of RxJS/NgRx for app state:

```typescript
// src/app/shared/services/settings.service.ts
export interface AppSettings {
    language: 'es' | 'en';
    timezone: string;
}

function getDefaultLanguage(): 'es' | 'en' {
    try {
        const browserLanguage = navigator.language ?? navigator.languages?.[0];
        return browserLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
    } catch {
        return 'en';
    }
}

const DEFAULT_SETTINGS: AppSettings = {
    language: getDefaultLanguage(),
    timezone: getDefaultTimezone(),
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private readonly localStorage = inject(LocalStorageService);

    public settings = signal<AppSettings>(this.loadSettings());

    private loadSettings(): AppSettings {
        const stored = this.localStorage.GetItem<AppSettings>('app_settings');
        return { ...DEFAULT_SETTINGS, ...stored };
    }

    public Save(settings: AppSettings): void {
        this.settings.set(settings);
        this.localStorage.SetItem('app_settings', settings);
    }
}
```

Key points:

- The **default language is derived from the browser's own locale** (`navigator.language`) the first time the app runs, not hardcoded — it only defaults to `'es'` when the browser reports a Spanish locale, and to `'en'` for everything else (including when detection fails).
- Once the user has saved a preference, it's **persisted in `localStorage`** (via `LocalStorageService`, under the `'app_settings'` key) and takes priority over the browser locale on subsequent loads.
- Language is restricted to a `'es' | 'en'` union type — matching the two cultures the backend actually supports (`SharedResource.resx` / `SharedResource.es.resx`).

---

## 2. The interceptor

`src/app/shared/interceptors/language.interceptor.ts` is a **functional interceptor** (`HttpInterceptorFn`, the modern, standalone-API style — this project doesn't use the older class-based `HttpInterceptor`/`HTTP_INTERCEPTORS` approach anywhere). It reads the current language synchronously from `SettingsService.settings()` on every request and clones the outgoing request with the header set:

```typescript
// src/app/shared/interceptors/language.interceptor.ts
import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { SettingsService } from "../services/settings.service";

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
    const settingsService = inject(SettingsService);

    const clonedRequest = req.clone({
        setHeaders: { 'Accept-Language': settingsService.settings().language }
    });

    return next(clonedRequest);
};
```

Because `req` is immutable, the header is set via `req.clone({ setHeaders: {...} })` rather than mutating `req.headers` directly. Reading `settingsService.settings()` inside the interceptor body (not cached in a module-level variable) means every request always carries the language that's current *at request time* — no separate "language changed" event or manual interceptor update is needed.

There is no domain/route exclusion logic in this interceptor: every request in this app goes through `HttpService` (`shared/services/http.service.ts`) to the same-origin API (`withCredentials: true` for the auth cookie), so there's no third-party/cross-origin traffic to exclude the header from.

---

## 3. Registration in `app.config.ts`

The interceptor is registered once, application-wide, via `provideHttpClient(withInterceptors([...]))` — the standalone equivalent of `HTTP_INTERCEPTORS`:

```typescript
// src/app/app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { languageInterceptor } from './shared/interceptors/language.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([languageInterceptor])),
    // ...other providers (PrimeNG, MessageService, ConfirmationService, etc.)
  ]
};
```

Since `HttpService` builds on top of Angular's `HttpClient` rather than replacing it, every call made through `Get`/`Post`/`PostForm`/`Put`/`PutForm`/`Delete`/`Ping` automatically goes through this interceptor and carries the `Accept-Language` header — no per-call wiring is required.

---

## 4. Changing the language at runtime

The language is changed from the settings page (`src/app/pages/main/pages/settings/settings.component.ts`), which reads the current value into a local signal, lets the user pick a new one from `SettingsService.languageOptions`, and persists it back through `SettingsService.Save(...)`:

```typescript
// src/app/pages/main/pages/settings/settings.component.ts
public readonly settingsService = inject(SettingsService);
public language = signal(this.settingsService.settings().language);
public timezone = signal(this.settingsService.settings().timezone);

public async OnSubmit(e: SubmitEvent) {
  e.preventDefault();
  this.settingsService.Save({
    language: this.language(),
    timezone: this.timezone(),
  });
  // ...
}
```

Because the interceptor reads `settingsService.settings()` fresh on every request rather than caching it, saving a new language here is immediately reflected in the next HTTP call — no reload, no manual notification to the interceptor.

---

## 5. Notes on further i18n integration

- `@ngx-translate/core` is listed in `package.json` but is **not currently wired up anywhere in `src/`** — there's no UI copy translation in the SPA today, only the `Accept-Language` header sent to the backend. If UI-string translation is added later, it should read/write the same `SettingsService.settings().language` signal instead of introducing a second, separate language state — that's the single source of truth this interceptor already depends on.
- PrimeNG's own translation table (configured in `app.config.ts` via `providePrimeNG({ translation: { ... } })`) is currently hardcoded to Spanish strings (`accept: 'Aceptar'`, `cancel: 'Cancelar'`, etc.) and is independent of `SettingsService` — it is not affected by this interceptor and isn't part of the `Accept-Language` flow described here.

---

## Summary

1. `SettingsService` (`shared/services/settings.service.ts`) holds `AppSettings.language` in a `signal`, defaulting from `navigator.language` and persisted to `localStorage` via `LocalStorageService`.
2. `languageInterceptor` (`shared/interceptors/language.interceptor.ts`) is a functional `HttpInterceptorFn` that reads `settingsService.settings().language` on every request and clones it with `Accept-Language` set via `setHeaders`.
3. It's registered once in `app.config.ts` via `provideHttpClient(withInterceptors([languageInterceptor]))`, so every call made through `HttpService` picks it up automatically.
4. Changing the language (`settings.component.ts` → `SettingsService.Save(...)`) takes effect on the very next HTTP request, with no extra plumbing needed.
