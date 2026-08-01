import { effect, inject, Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "./auth.service";
import { AlertService } from "./alert.service";

// Non-blocking heads-up shown shortly before the hard lock, so the user isn't surprised mid-edit.
const WARNING_BEFORE_LOCK_MS = 60_000;

@Injectable({ providedIn: 'root' })

export class VaultLockService {
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly translate = inject(TranslateService);

  private warningTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lockTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Reacts to every path that unlocks the vault (login, unlock-after-reload, periodic
    // re-verification) and to every path that locks it (explicit lock, logout), since they all
    // flow through AuthService.unlocked - no need to call startTimer()/clearTimer() by hand.
    effect(() => {
      if (this.authService.unlocked()) {
        this.startTimer();
      } else {
        this.clearTimer();
      }
    });
  }

  private startTimer(): void {
    this.clearTimer();

    const freshnessMinutes = this.authService.currentUser()?.vaultFreshnessMinutes ?? 60;
    const freshnessMs = freshnessMinutes * 60 * 1000;
    const warnAtMs = Math.max(freshnessMs - WARNING_BEFORE_LOCK_MS, 0);

    this.warningTimeoutId = setTimeout(() => {
      this.alertService.showWarn(
        this.translate.instant('vaultLock.warningTitle'),
        this.translate.instant('vaultLock.warningMessage'),
      );
    }, warnAtMs);

    this.lockTimeoutId = setTimeout(() => {
      this.authService.Lock();
    }, freshnessMs);
  }

  private clearTimer(): void {
    if (this.warningTimeoutId !== null) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    if (this.lockTimeoutId !== null) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = null;
    }
  }
}
