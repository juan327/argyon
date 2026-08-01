import { inject, Injectable } from "@angular/core";
import { DTOGeneric, DTOUser } from "../dto";
import { HttpService } from "./http.service";

// Refresh a bit before the access token actually expires, so requests almost never
// have to fall back to the reactive (401-then-retry) path in authInterceptor.
const REFRESH_BEFORE_EXPIRY_MS = 60_000;

export interface RefreshResult {
  vaultFresh: boolean;
}

@Injectable({ providedIn: 'root' })

export class TokenRefreshService {
  private readonly httpService = inject(HttpService);

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<RefreshResult | null> | null = null;

  /**
   * Starts the proactive silent-refresh loop: calls POST User/Refresh shortly before the
   * access token expires and reschedules itself after each success. Stops rescheduling (but
   * does not itself redirect anywhere) if a refresh fails - HttpService's normal 401 handling
   * takes care of that.
   */
  public start(accessTokenExpiryMinutes: number): void {
    this.stop();
    this.scheduleNext(accessTokenExpiryMinutes);
  }

  public stop(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNext(accessTokenExpiryMinutes: number): void {
    const delayMs = Math.max(accessTokenExpiryMinutes * 60 * 1000 - REFRESH_BEFORE_EXPIRY_MS, 5_000);
    this.timeoutId = setTimeout(async () => {
      const result = await this.refresh();
      if (result !== null) {
        this.scheduleNext(accessTokenExpiryMinutes);
      }
    }, delayMs);
  }

  /**
   * Rotates the refresh token / reissues the access token. Deduplicated: concurrent callers
   * (the proactive timer and the reactive authInterceptor) share the same in-flight request
   * instead of each triggering their own rotation.
   *
   * `silent` (propagated from a SILENT_401-flagged request, e.g. Ping(false) on the public
   * login/register pages) suppresses the /login navigation this would otherwise trigger on
   * failure: an opportunistic check with no prior session must not force a redirect.
   */
  public async refresh(silent = false): Promise<RefreshResult | null> {
    if (this.inFlight !== null) {
      return this.inFlight;
    }
    this.inFlight = this.doRefresh(silent);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async doRefresh(silent: boolean): Promise<RefreshResult | null> {
    const { response, success } = await this.httpService.Post<DTOGeneric.DTOResponseApiData<DTOUser.DTORefreshResponse>>('User/Refresh', {}, { suppressAuthRedirect: silent });
    if (success === false) {
      return null;
    }
    return { vaultFresh: response.data.vaultFresh };
  }
}
