import { effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

const APP_NAME = 'Argyon';

function findDeepestTitleKey(snapshot: ActivatedRouteSnapshot): string | undefined {
    let current: ActivatedRouteSnapshot | null = snapshot;
    let titleKey: string | undefined;
    while (current) {
        titleKey = current.data['titleKey'] ?? titleKey;
        current = current.firstChild;
    }
    return titleKey;
}

/**
 * Keeps the browser tab title in sync with the active route (via each route's
 * `data.titleKey`, see app.routes.ts) and the user's selected language, since
 * ngx-translate keys can't be read from a route's static `title` property.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleService {
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);
    private readonly titleService = inject(Title);

    private readonly titleKey = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map(() => findDeepestTitleKey(this.router.routerState.snapshot.root))
        ),
        { initialValue: findDeepestTitleKey(this.router.routerState.snapshot.root) }
    );

    constructor() {
        effect(() => {
            const key = this.titleKey();
            this.translate.currentLang();
            const moduleTitle = key ? this.translate.instant(key) : undefined;
            this.titleService.setTitle(moduleTitle ? `${moduleTitle} - ${APP_NAME}` : APP_NAME);
        });
    }
}
