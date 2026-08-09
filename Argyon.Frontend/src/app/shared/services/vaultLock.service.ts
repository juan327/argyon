import { DOCUMENT } from "@angular/common";
import { effect, inject, Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "./auth.service";
import { AlertService } from "./alert.service";
import { HttpService } from "./http.service";
import { DTOGeneric } from "../dto";

// Non-blocking heads-up shown shortly before the hard lock, so the user isn't surprised mid-edit.
const WARNING_BEFORE_LOCK_MS = 60_000;

// Heartbeat period while the tab is visible: comfortably shorter than the freshness deadline so
// a touch always lands before it, with a floor so short freshness windows (dev/testing) don't
// hammer the server.
const MIN_HEARTBEAT_MS = 30_000;
const MAX_HEARTBEAT_MS = 5 * 60_000;

@Injectable({ providedIn: 'root' })

export class VaultLockService {
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly httpService = inject(HttpService);
  private readonly document = inject(DOCUMENT);

  private warningTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

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

    // Registered once (not inside the effect) so it isn't attached/detached on every unlock
    // transition. While the tab is visible, a heartbeat keeps both the local deadline and the
    // server-side VaultUnlockedAt window pushed forward, so an actively-used tab never hits the
    // auto-lock. Hiding the tab (switching away, minimizing) just stops the heartbeat - the
    // already-scheduled deadline keeps counting down and can still lock while the tab is hidden.
    this.document.addEventListener('visibilitychange', () => {
      if (this.authService.unlocked() === false) {
        return;
      }
      if (this.document.visibilityState === 'visible') {
        // Also covers the edge case where the deadline already elapsed (or nearly did) while the
        // tab was hidden: this either extends the session or fails with vault_reauth_required,
        // which authInterceptor already turns into a Lock().
        this.touchVault();
      } else {
        this.stopHeartbeat();
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

    if (this.document.visibilityState === 'visible') {
      this.startHeartbeat(freshnessMs);
    }
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
    this.stopHeartbeat();
  }

  private startHeartbeat(freshnessMs: number): void {
    this.stopHeartbeat();
    const intervalMs = Math.max(MIN_HEARTBEAT_MS, Math.min(MAX_HEARTBEAT_MS, freshnessMs / 4));
    this.heartbeatIntervalId = setInterval(() => this.touchVault(), intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  // Extends the server-side freshness window (POST User/TouchVault, only succeeds while the
  // session is still fresh) and, on success, restarts the local warning/lock deadline and
  // heartbeat from now. A failure (e.g. vault_reauth_required) needs no handling here:
  // authInterceptor already locks the vault, which the effect() above reacts to.
  private async touchVault(): Promise<void> {
    const { success } = await this.httpService.Post<DTOGeneric.DTOResponseApi>('User/TouchVault', {});
    if (success && this.authService.unlocked()) {
      this.startTimer();
    }
  }
}
