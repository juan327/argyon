import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';
import { languageInterceptor } from './shared/interceptors/language.interceptor';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';
import { getInitialLanguage } from './shared/services/settings.service';
import { primeNgTranslations } from './shared/i18n/primeng-translations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([languageInterceptor, authInterceptor])),
    provideTranslateService({
      fallbackLang: 'en',
      // useHttpBackend bypasses withInterceptors([languageInterceptor]): that interceptor
      // injects SettingsService, which injects TranslateService, which (via the loader)
      // needs HttpClient — routing translation-file loads through the same intercepted
      // HttpClient creates a circular DI dependency (NG0200). Translation JSON files are
      // static assets, not authenticated API calls, so bypassing interceptors is correct too.
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json', useHttpBackend: true }),
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      return firstValueFrom(translate.use(getInitialLanguage()));
    }),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'system'
        }
      },
      translation: primeNgTranslations[getInitialLanguage()],
    }),
    MessageService,
    ConfirmationService,

  ]
};
