import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form, FormField, min, minLength, required } from '@angular/forms/signals';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from 'src/app/shared/services/auth.service';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DatabaseService } from 'src/app/shared/services/database.service';
import { TranslateService } from '@ngx-translate/core';
import { AlertService } from 'src/app/shared/services/alert.service';
import { TokenRefreshService } from 'src/app/shared/services/token-refresh.service';

@Component({
    selector: 'partial-nav',
    imports: [RouterModule, MenuModule],
    templateUrl: './nav.component.html',
    styleUrls: ['./nav.component.css']
})

export class NavComponent {
    public readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly databaseService = inject(DatabaseService);
    private readonly translate = inject(TranslateService);
    private readonly alertService = inject(AlertService);
    private readonly tokenRefreshService = inject(TokenRefreshService);

    public onCloseNav = output<void>();

    // Tracks the active route so menu items can be highlighted to match; router.url
    // alone isn't reactive, so this re-derives it from NavigationEnd events.
    private readonly currentUrl = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map(event => event.urlAfterRedirects)
        ),
        { initialValue: this.router.url }
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
        this.translate.currentLang();
        // Read so this computed re-evaluates (and re-highlights the active item)
        // whenever the route changes.
        this.currentUrl();

        const accountGroup: MenuItem = {
            label: this.translate.instant('nav.accountGroup'),
            items: [
                {
                    label: this.translate.instant('nav.lockAccount'),
                    icon: 'pi pi-lock',
                    command: () => this.lockAccount()
                },
                {
                    label: this.translate.instant('nav.logOut'),
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
                    label: this.translate.instant('nav.navigationGroup'),
                    items: [
                        {
                            label: this.translate.instant('nav.exportMyData'),
                            icon: 'pi pi-database',
                            styleClass: this.activeStyleClass('/data'),
                            command: () => {
                                this.onCloseNav.emit();
                                this.router.navigate(['/data']);
                            }
                        },
                    ]
                },
                accountGroup,
            ];
        }

        const navigationItems: MenuItem[] = [
            {
                label: this.translate.instant('nav.home'),
                icon: 'pi pi-home',
                styleClass: this.activeStyleClass('/home'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/home']);
                }
            },
            {
                label: this.translate.instant('nav.settings'),
                icon: 'pi pi-cog',
                styleClass: this.activeStyleClass('/settings'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/settings']);
                }
            },
            {
                label: this.translate.instant('nav.dataExportImport'),
                icon: 'pi pi-database',
                styleClass: this.activeStyleClass('/data'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/data']);
                }
            },
            {
                label: this.translate.instant('nav.about'),
                icon: 'pi pi-info-circle',
                styleClass: this.activeStyleClass('/about'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/about']);
                }
            },
        ];

        if (this.authService.canViewUsersModule()) {
            navigationItems.push({
                label: this.translate.instant('nav.users'),
                icon: 'pi pi-users',
                styleClass: this.activeStyleClass('/users'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/users']);
                }
            });
        }

        if (this.authService.canManageUsers()) {
            navigationItems.push({
                label: this.translate.instant('nav.system'),
                icon: 'pi pi-shield',
                styleClass: this.activeStyleClass('/system'),
                command: () => {
                    this.onCloseNav.emit();
                    this.router.navigate(['/system']);
                }
            });
        }

        return [
            {
                label: this.translate.instant('nav.navigationGroup'),
                items: navigationItems
            },
            accountGroup,
        ];
    });

    public onLogoClick() {
        this.onCloseNav.emit();
        this.router.navigate(['/home']);
    }

    public lockAccount() {
        this.onCloseNav.emit();
        this.authService.Lock();
    }

    public logout() {
        this.alertService.showConfirmation({
            title: this.translate.instant('nav.confirmLogOutTitle'),
            message: this.translate.instant('nav.confirmLogOutMessage'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translate.instant('nav.logOut'),
            acceptSeverity: 'danger',
            accept: async () => {
                // DatabaseService is an app-wide singleton (it is not destroyed on navigation): if a
                // sync stream was left open, it has to be closed here or it would keep running after going back to /login.
                this.databaseService.CloseStream();
                this.tokenRefreshService.stop();
                this.alertService.showLoading(this.translate.instant('nav.loggingOut'));
                await this.authService.Logout();
                this.alertService.hideLoading();
                this.router.navigate(['/login']);
            }
        });
    }

}
