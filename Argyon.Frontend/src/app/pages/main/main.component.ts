import { Component, HostListener, inject, signal } from '@angular/core';
import { form, FormField, min, minLength, required } from '@angular/forms/signals';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { MainService } from './main.service';
import { UnlockComponent } from './partials/unlock/unlock.component';
import { AuthService } from 'src/app/shared/services/auth.service';
import { NavComponent } from "./partials/nav/nav.component";
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { DrawerModule } from 'primeng/drawer';
import { TokenRefreshService } from 'src/app/shared/services/token-refresh.service';
import { VaultLockService } from 'src/app/shared/services/vault-lock.service';

@Component({
  selector: 'app-main',
  imports: [RouterModule, UnlockComponent, NavComponent, ButtonComponent, DrawerModule],
  templateUrl: './main.component.html'
})

export class MainComponent {
  public readonly _thisService = inject(MainService);
  public readonly _authService = inject(AuthService);
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

    this._tokenRefreshService.start(this._authService.currentUser()?.accessTokenExpiryMinutes ?? 15);
  }

  public onToggleSidebar() {
    this.showSidebar.update(value => !value);
  }
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.screenWidth.set(event.target.innerWidth);
  }

}
