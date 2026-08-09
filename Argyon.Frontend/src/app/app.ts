import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { LoadingComponent } from "./shared/components/loading/loading.component";
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { primeNgTranslations } from './shared/i18n/primeng-translations';
import { PageTitleService } from './shared/services/pageTitle.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastModule, LoadingComponent, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('Argyon.Frontend');

  private readonly translate = inject(TranslateService);
  private readonly primeNGConfig = inject(PrimeNG);
  // Injected only to activate it at startup; it keeps the tab title in sync with the route and language on its own.
  private readonly pageTitleService = inject(PageTitleService);

  constructor() {
    effect(() => {
      const lang = this.translate.currentLang() ?? 'en';
      document.documentElement.lang = lang;
      this.primeNGConfig.setTranslation(primeNgTranslations[lang === 'es' ? 'es' : 'en']);
    });
  }
}
