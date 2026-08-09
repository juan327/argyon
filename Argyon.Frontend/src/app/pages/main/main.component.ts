import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { MainService } from './main.service';
import { UnlockComponent } from './partials/unlock/unlock.component';
import { AuthService } from 'src/app/shared/services/auth.service';
import { NavComponent } from "./partials/nav/nav.component";
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { DrawerModule } from 'primeng/drawer';
import { TokenRefreshService } from 'src/app/shared/services/tokenRefresh.service';
import { VaultLockService } from 'src/app/shared/services/vaultLock.service';

@Component({
  selector: 'app-main',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, UnlockComponent, NavComponent, ButtonComponent, DrawerModule],
  templateUrl: './main.component.html',
  host: {
    '(window:resize)': 'onResize($event)'
  }
})

export class MainComponent {
  public readonly thisService = inject(MainService);
  public readonly authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _tokenRefreshService = inject(TokenRefreshService);
  // Not otherwise referenced: injecting it here just instantiates the singleton so its
  // internal effect (watching AuthService.unlocked) starts running for this session.
  private readonly _vaultLockService = inject(VaultLockService);

  public showSidebar = signal(true);
  public screenWidth = signal(window.innerWidth);
  public readonly breakWidth = 800;

  async ngOnInit() {
    this.screenWidth.set(window.innerWidth);
    if (this.screenWidth() < this.breakWidth) {
      this.showSidebar.set(false);
    }

    this._tokenRefreshService.start(this.authService.currentUser()?.accessTokenExpiryMinutes ?? 15);
  }

  public onToggleSidebar() {
    this.showSidebar.update(value => !value);
  }

  public onResize(event: UIEvent) {
    this.screenWidth.set((event.target as Window).innerWidth);
  }
}
