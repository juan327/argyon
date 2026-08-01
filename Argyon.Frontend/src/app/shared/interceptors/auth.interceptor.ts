import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, from, switchMap, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { TokenRefreshService } from "../services/token-refresh.service";
import { SILENT_401 } from "../services/http.service";

// Distinguishes the three ways a 401 can happen in this app and reacts accordingly:
// - "vault_reauth_required": the access/refresh tokens are fine, but the master password
//   hasn't been re-verified in the configured window - show the lock screen, don't touch tokens.
// - "refresh_reuse_detected": a refresh token was replayed after already being rotated
//   (possible theft) - the whole family was revoked server-side, force a full logout.
// - anything else: a plain expired access token - silently refresh once and retry.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenRefreshService = inject(TokenRefreshService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if ((error instanceof HttpErrorResponse) === false || error.status !== 401) {
        return throwError(() => error);
      }

      const code = (error.error as { code?: string } | null)?.code;

      if (code === 'vault_reauth_required') {
        authService.Lock();
        return throwError(() => error);
      }

      if (code === 'refresh_reuse_detected') {
        authService.Lock();
        authService.currentUser.set(null);
        tokenRefreshService.stop();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      // The refresh call itself failed: nothing left to retry with, let it fail normally
      // (HttpService.handleUnauthorized will redirect to /login).
      if (req.url.includes('User/Refresh')) {
        return throwError(() => error);
      }

      return from(tokenRefreshService.refresh(req.context.get(SILENT_401))).pipe(
        switchMap(result => {
          if (result === null) {
            return throwError(() => error);
          }
          if (result.vaultFresh === false) {
            authService.Lock();
          }
          return next(req);
        }),
      );
    }),
  );
};
