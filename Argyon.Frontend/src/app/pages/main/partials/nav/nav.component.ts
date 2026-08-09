import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from 'src/app/shared/services/auth.service';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { TranslateService } from '@ngx-translate/core';
import { AlertService } from 'src/app/shared/services/alert.service';
import { TokenRefreshService } from 'src/app/shared/services/tokenRefresh.service';

@Component({
    selector: 'partial-nav',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterModule, MenuModule],
    templateUrl: './nav.component.html',
    styleUrls: ['./nav.component.css']
})

export class NavComponent {
    public readonly authService = inject(AuthService);
    private readonly _router = inject(Router);
    private readonly _databaseService = inject(DatabaseService);
    private readonly _translate = inject(TranslateService);
    private readonly _alertService = inject(AlertService);
    private readonly _tokenRefreshService = inject(TokenRefreshService);

    public onCloseNav = output<void>();

    // Tracks the active route so menu items can be highlighted to match; router.url
    // alone isn't reactive, so this re-derives it from NavigationEnd events.
    private readonly currentUrl = toSignal(
        this._router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map(event => event.urlAfterRedirects)
        ),
        { initialValue: this._router.url }
    );

    private isActiveRoute(route: string): boolean {
        const url = this.currentUrl();
        return url === route || url.startsWith(`${route}/`);
    }

    private activeStyleClass(route: string): string | undefined {
        return this.isActiveRoute(route) ? 'nav-item-active' : undefined;
    }

    // Computed (not a fixed array built in ngOnInit) because the user's role
    // loads asynchronously (AuthGuard) and may not be ready yet.
    public _items = computed<MenuItem[]>(() => {
        // Read as a signal (not .instant()) so this computed re-evaluates,
        // and the labels re-translate, whenever the active language changes.
        this._translate.currentLang();
        // Read so this computed re-evaluates (and re-highlights the active item)
        // whenever the route changes.
        this.currentUrl();

        const accountGroup: MenuItem = {
            label: this._translate.instant('nav.accountGroup'),
            items: [
                {
                    label: this._translate.instant('nav.lockAccount'),
                    icon: 'pi pi-lock',
                    command: () => this.lockAccount()
                },
                {
                    label: this._translate.instant('nav.logOut'),
                    icon: 'pi pi-sign-out',
                    command: () => this.logout()
                },
            ]
        };

        // A blocked account can only export its data: the rest of the
        // navigation is hidden from it (the route guards would prevent it anyway).
        if (this.authService.isBlocked()) {
            return [
                {
                    label: this._translate.instant('nav.navigationGroup'),
                    items: [
                        {
                            label: this._translate.instant('nav.exportMyData'),
                            icon: 'pi pi-database',
                            styleClass: this.activeStyleClass('/data'),
                            command: () => {
                                this.onCloseNav.emit();
                                this._router.navigate(['/data']);
                            }
                        },
                    ]
                },
                accountGroup,
            ];
        }

        const navigationItems: MenuItem[] = [
            {
                label: this._translate.instant('nav.home'),
                icon: 'pi pi-home',
                styleClass: this.activeStyleClass('/home'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/home']);
                }
            },
            {
                label: this._translate.instant('nav.settings'),
                icon: 'pi pi-cog',
                styleClass: this.activeStyleClass('/settings'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/settings']);
                }
            },
            {
                label: this._translate.instant('nav.dataExportImport'),
                icon: 'pi pi-database',
                styleClass: this.activeStyleClass('/data'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/data']);
                }
            },
            {
                label: this._translate.instant('nav.about'),
                icon: 'pi pi-info-circle',
                styleClass: this.activeStyleClass('/about'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/about']);
                }
            },
        ];

        if (this.authService.canViewUsersModule()) {
            navigationItems.push({
                label: this._translate.instant('nav.users'),
                icon: 'pi pi-users',
                styleClass: this.activeStyleClass('/users'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/users']);
                }
            });
        }

        if (this.authService.canManageUsers()) {
            navigationItems.push({
                label: this._translate.instant('nav.system'),
                icon: 'pi pi-shield',
                styleClass: this.activeStyleClass('/system'),
                command: () => {
                    this.onCloseNav.emit();
                    this._router.navigate(['/system']);
                }
            });
        }

        return [
            {
                label: this._translate.instant('nav.navigationGroup'),
                items: navigationItems
            },
            accountGroup,
        ];
    });

    public onLogoClick() {
        this.onCloseNav.emit();
        this._router.navigate(['/home']);
    }

    public lockAccount() {
        this.onCloseNav.emit();
        this.authService.Lock();
    }

    public logout() {
        this._alertService.showConfirmation({
            title: this._translate.instant('nav.confirmLogOutTitle'),
            message: this._translate.instant('nav.confirmLogOutMessage'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this._translate.instant('nav.logOut'),
            acceptSeverity: 'danger',
            accept: async () => {
                // DatabaseService is an app-wide singleton (it is not destroyed on navigation): if a
                // sync stream was left open, it has to be closed here or it would keep running after going back to /login.
                this._databaseService.CloseStream();
                this._tokenRefreshService.stop();
                this._alertService.showLoading(this._translate.instant('nav.loggingOut'));
                await this.authService.Logout();
                this._alertService.hideLoading();
                this._router.navigate(['/login']);
            }
        });
    }

}
